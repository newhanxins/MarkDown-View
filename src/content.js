// 导入样式文件
import './content.css';
// 导入核心依赖库
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
// 导入功能模块
import { takeScreenshot, takeManualScreenshot } from './modules/screenshot.js';
import { addRecentFile, renderRecentFiles } from './modules/recent-files.js';
import { showShortcutsDialog } from './modules/shortcuts.js';


(function() {
  'use strict';

  // 【关键】content script 一执行就立即回到顶部，防止浏览器基于原始 DOM 恢复滚动位置
  const contentAreaEl = document.getElementById('md-content-area');
  if (contentAreaEl) {
    contentAreaEl.scrollTo({ top: 0 });
  } else {
    window.scrollTo(0, 0);
  }

  // 禁用浏览器自动恢复滚动位置（对前进/后退导航生效）
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  // ==========================================
  // 1. 初始化配置与全局变量
  // ==========================================

  /**
   * 兼容函数：在插件环境和本地测试环境中都能获取资源路径
   * @param {string} path - 资源相对路径
   * @returns {string} 完整的资源 URL
   */
  function getAssetPath(path) {
    // 如果是 Chrome 扩展环境
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      return chrome.runtime.getURL(path);
    }
    // 如果是本地测试环境 (Vite Dev Server)，直接返回相对路径
    // 假设 libs 文件夹在 public 目录下，开发时 Vite 会从 public 根目录提供
    return '/' + path;
  }

  // 库的地址配置
  const LIBS = {
    mermaid: {
      local: getAssetPath('libs/mermaid.min.js'),
      cdn: 'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js',
      globalVar: 'mermaid'
    },
    katexCss: {
      local: getAssetPath('libs/katex.min.css'),
      cdn: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
      isCss: true
    },
    katexJs: {
      local: getAssetPath('libs/katex.min.js'),
      cdn: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
      globalVar: 'katex'
    },
    katexAutoRender: {
      local: getAssetPath('libs/auto-render.min.js'),
      cdn: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js',
      globalVar: 'renderMathInElement'
    }
  };

  let mermaidLoaded = false;
  let mermaidInstance = null;
  let katexLoaded = false;// 用于标记 KaTeX 是否已加载

  // 功能配置开关：默认为 true，方便后续通过配置文件或 UI 控制
  const CONFIG = {
    enableTOC: true,      // 是否启用左侧目录导航
    enableMermaid: true,  // 是否启用 Mermaid 图表渲染
    enableEditor: true,    // 是否启用实时编辑功能
    enableMath: true, // 新增：数学公式开关
    enableEmoji: true,     // 是否启用 Emoji 短代码渲染
    enableHighlight: true  // 是否启用代码语法高亮
  };

  // ==========================================
  // Emoji 短代码映射表
  // ==========================================
  const EMOJI_MAP = {
    ':smile:': '😄', ':grin:': '😁', ':joy:': '😂', ':sweat_smile:': '',
    ':laughing:': '😆', ':wink:': '😉', ':blush:': '😊', ':yum:': '😋',
    ':sunglasses:': '😎', ':heart_eyes:': '😍', ':kissing_heart:': '😘',
    ':kissing:': '😗', ':relaxed:': '☺️', ':thinking:': '🤔', ':neutral_face:': '😐',
    ':expressionless:': '😑', ':confused:': '😕', ':worried:': '',
    ':frowning:': '😦', ':anguished:': '😧', ':open_mouth:': '😮',
    ':astonished:': '😲', ':flushed:': '😳', ':scream:': '😱',
    ':dizzy_face:': '😵', ':cool:': '😎', ':nerd:': '🤓',
    ':heart:': '❤️', ':orange_heart:': '🧡', ':yellow_heart:': '💛',
    ':green_heart:': '💚', ':blue_heart:': '💙', ':purple_heart:': '💜',
    ':black_heart:': '🖤', ':broken_heart:': '💔', ':two_hearts:': '💕',
    ':sparkling_heart:': '💖', ':star:': '⭐', ':fire:': '🔥',
    ':rocket:': '🚀', ':zap:': '⚡', ':boom:': '💥', ':dash:': '💨',
    ':muscle:': '💪', ':pray:': '🙏', ':clap:': '👏', ':thumbsup:': '👍',
    ':thumbsdown:': '👎', ':ok_hand:': '👌', ':point_up:': '☝️',
    ':point_right:': '👉', ':point_left:': '👈', ':raised_hand:': '✋',
    ':wave:': '👋', ':v:': '✌️', ':crossed_fingers:': '🤞',
    ':100:': '💯', ':zzz:': '💤', ':sweat_drops:': '💦', ':droplet:': '💧',
    ':gift:': '🎁', ':tada:': '🎉', ':confetti_ball:': '🎊',
    ':balloon:': '🎈', ':crown:': '👑', ':gem:': '💎', ':trophy:': '🏆',
    ':medal:': '🏅', ':first_place:': '🥇', ':second_place:': '🥈',
    ':third_place:': '🥉', ':soccer:': '⚽', ':basketball:': '🏀',
    ':football:': '🏈', ':baseball:': '⚾', ':tennis:': '🎾',
    ':ping_pong:': '🏓', ':badminton:': '🏸', ':golf:': '⛳',
    ':trophy:': '🏆', ':dart:': '🎯', ':8ball:': '🎱', ':bowling:': '🎳',
    ':video_game:': '🎮', ':joystick:': '🕹️', ':slot_machine:': '🎰',
    ':dice:': '🎲', ':spades:': '♠️', ':hearts:': '♥️', ':diamonds:': '♦️',
    ':clubs:': '♣️', ':joker:': '🃏', ':mahjong:': '🀄', ':flower_playing_cards:': '🎴',
    ':art:': '🎨', ':headphones:': '🎧', ':microphone:': '🎤',
    ':musical_note:': '🎵', ':notes:': '🎶', ':guitar:': '🎸',
    ':musical_keyboard:': '🎹', ':trumpet:': '🎺', ':violin:': '🎻',
    ':saxophone:': '🎷', ':drum:': '🥁', ':iphone:': '📱',
    ':calling:': '📲', ':computer:': '💻', ':desktop_computer:': '🖥️',
    ':keyboard:': '⌨️', ':printer:': '🖨️', ':mouse_three_button:': '🖱️',
    ':trackball:': '🖲️', ':minidisc:': '💽', ':floppy_disk:': '💾',
    ':cd:': '💿', ':dvd:': '📀', ':movie_camera:': '🎥', ':film_frames:': '🎞️',
    ':projector:': '📽️', ':clapper:': '🎬', ':tv:': '📺', ':camera:': '📷',
    ':camera_with_flash:': '', ':video_camera:': '📹', ':vhs:': '📼',
    ':mag:': '🔍', ':mag_right:': '🔎', ':bulb:': '💡', ':flashlight:': '🔦',
    ':candle:': '🕯️', ':battery:': '🔋', ':electric_plug:': '🔌',
    ':lock:': '🔒', ':unlock:': '🔓', ':key:': '🔑', ':lock_with_ink_pen:': '🔏',
    ':closed_lock_with_key:': '🔐', ':bookmark:': '🔖', ':link:': '🔗',
    ':paperclip:': '📎', ':triangular_ruler:': '📐', ':straight_ruler:': '📏',
    ':scissors:': '✂️', ':pen:': '🖊️', ':fountain_pen:': '🖋️',
    ':paintbrush:': '🖌️', ':crayon:': '🖍️', ':memo:': '📝', ':pencil:': '✏️',
    ':books:': '📚', ':book:': '📖', ':notebook:': '📓', ':ledger:': '📒',
    ':scroll:': '📜', ':page_facing_up:': '📄', ':page_with_curl:': '📃',
    ':newspaper:': '📰', ':bookmark_tabs:': '📑', ':label:': '🏷️',
    ':moneybag:': '💰', ':credit_card:': '💳', ':chart:': '📊',
    ':envelope:': '✉️', ':e-mail:': '📧', ':incoming_envelope:': '📨',
    ':mailbox:': '📫', ':postbox:': '📮', ':package:': '📦',
    ':postal_horn:': '📯', ':inbox_tray:': '📥', ':outbox_tray:': '📤',
    ':white_check_mark:': '✅', ':heavy_check_mark:': '✔️', ':x:': '❌',
    ':cross_mark:': '❌', ':negative_squared_cross_mark:': '❎',
    ':question:': '❓', ':exclamation:': '❗', ':heavy_exclamation_mark:': '❗',
    ':bangbang:': '‼️', ':interrobang:': '⁉️', ':information_source:': 'ℹ️',
    ':warning:': '⚠️', ':underage:': '🔞', ':no_entry:': '⛔',
    ':no_entry_sign:': '🚫', ':prohibited:': '🚫', ':no_mobile_phones:': '📵',
    ':no_smoking:': '🚭', ':do_not_litter:': '🚯', ':non-potable_water:': '🚱',
    ':no_bicycles:': '🚳', ':no_pedestrians:': '🚷', ':children_crossing:': '🚸',
    ':beginner:': '🔰', ':recycle:': '♻️', ':trident:': '🔱',
    ':fleur_de_lis:': '⚜️', ':part_alternation_mark:': '〽️',
    ':congratulations:': '㊗️', ':secret:': '㊙️', ':u5272:': '🈹',
    ':u5408:': '🈴', ':u55b6:': '🈺', ':u6307:': '🈯', ':u6708:': '🈷️',
    ':u6709:': '🈶', ':u6b80:': '🈲', ':u7121:': '🈚', ':u7533:': '🈸',
    ':u7981:': '🈲', ':u7a7a:': '🈳', ':sa:': '🈂️', ':ideograph_advantage:': '🉐',
    ':accept:': '🉑', ':clock1:': '🕐', ':clock2:': '🕑', ':clock3:': '🕒',
    ':clock4:': '🕓', ':clock5:': '🕔', ':clock6:': '🕕', ':clock7:': '🕖',
    ':clock8:': '🕗', ':clock9:': '🕘', ':clock10:': '🕙', ':clock11:': '🕚',
    ':clock12:': '🕛', ':clock130:': '🕜', ':clock230:': '🕝',
    ':clock330:': '🕞', ':clock430:': '🕟', ':clock530:': '',
    ':clock630:': '🕡', ':clock730:': '🕢', ':clock830:': '🕣',
    ':clock930:': '🕤', ':clock1030:': '🕥', ':clock1130:': '🕦',
    ':clock1230:': '🕧', ':female_sign:': '♀️', ':male_sign:': '♂️',
    ':transgender_symbol:': '⚧️', ':dna:': '🧬', ':virus:': '🦠',
    ':microbe:': '🦠', ':bone:': '🦴', ':tooth:': '🦷', ':eye:': '👁️',
    ':ear:': '👂', ':nose:': '👃', ':brain:': '🧠', ':anatomical_heart:': '🫀',
    ':lungs:': '🫁', ':stethoscope:': '🩺', ':syringe:': '💉',
    ':pill:': '💊', ':blood:': '🩸', ':bandage:': '🩹', ':crutch:': '🩼',
    ':wheelchair:': '♿', ':probing_cane:': '🦯', ':white_cane:': '🦯',
    ':construction_worker:': '👷', ':mechanic:': '🧑‍🔧', ':farmer:': '👨‍🌾',
    ':cook:': '🧑‍🍳', ':health_worker:': '🧑‍️', ':scientist:': '🧑‍🔬',
    ':artist:': '🧑‍', ':firefighter:': '🧑‍🚒', ':pilot:': '👨‍✈️',
    ':astronaut:': '👨‍🚀', ':judge:': '👨‍⚖️', ':police_officer:': '👮',
    ':detective:': '🕵️', ':guard:': '💂', ':ninja:': '🥷', ':student:': '👩‍🎓',
    ':teacher:': '👩‍🏫', ':office_worker:': '👩‍💼', ':technologist:': '👩‍',
    ':singer:': '👩‍🎤', ':actor:': '🧑‍', ':dancer:': '💃', ':person_in_tuxedo:': '🤵',
    ':person_with_veil:': '👰', ':princess:': '👸', ':prince:': '🤴',
    ':superhero:': '🦸', ':supervillain:': '🦹', ':mage:': '🧙',
    ':fairy:': '🧚', ':vampire:': '🧛', ':merperson:': '🧜', ':elf:': '🧝',
    ':genie:': '🧞', ':zombie:': '🧟', ':troll:': '🧌', ':baby:': '👶',
    ':child:': '🧒', ':boy:': '👦', ':girl:': '👧', ':adult:': '🧑',
    ':man:': '👨', ':woman:': '👩', ':older_adult:': '🧓', ':old_man:': '👴',
    ':old_woman:': '👵', ':family:': '👨‍👩‍👧', ':couple:': '👫',
    ':couple_with_heart:': '💑', ':couplekiss:': '💏', ':dog:': '🐕',
    ':cat:': '🐈', ':mouse:': '🐁', ':hamster:': '🐹', ':rabbit:': '🐇',
    ':fox:': '🦊', ':bear:': '🐻', ':panda:': '🐼', ':koala:': '🐨',
    ':tiger:': '🐅', ':lion:': '🦁', ':cow:': '🐄', ':pig:': '🐖',
    ':frog:': '🐸', ':monkey:': '🐒', ':chicken:': '🐔', ':penguin:': '🐧',
    ':bird:': '🐦', ':baby_chick:': '🐤', ':hatching_chick:': '🐣',
    ':hatched_chick:': '🐥', ':duck:': '🦆', ':eagle:': '🦅', ':owl:': '🦉',
    ':bat:': '🦇', ':wolf:': '🐺', ':boar:': '🐗', ':horse:': '🐎',
    ':unicorn:': '🦄', ':bee:': '🐝', ':bug:': '🐛', ':butterfly:': '🦋',
    ':snail:': '🐌', ':shell:': '🐚', ':beetle:': '🐞', ':ant:': '🐜',
    ':spider:': '️', ':scorpion:': '🦂', ':crab:': '🦀', ':snake:': '🐍',
    ':lizard:': '🦎', ':t-rex:': '🦖', ':sauropod:': '🦕', ':turtle:': '🐢',
    ':fish:': '🐟', ':blowfish:': '🐡', ':dolphin:': '🐬', ':whale:': '🐋',
    ':whale2:': '🐳', ':shark:': '🦈', ':octopus:': '🐙', ':coral:': '🪸',
    ':shrimp:': '🦐', ':squid:': '🦑', ':lobster:': '🦞', ':oyster:': '🦪',
    ':seal:': '🦭', ':crocodile:': '🐊', ':tiger2:': '🐅', ':leopard:': '🐆',
    ':zebra:': '🦓', ':gorilla:': '🦍', ':orangutan:': '🦧', ':elephant:': '🐘',
    ':mammoth:': '🦣', ':hippopotamus:': '🦛', ':rhinoceros:': '🦏',
    ':dromedary_camel:': '🐪', ':camel:': '🐫', ':giraffe:': '🦒',
    ':kangaroo:': '🦘', ':badger:': '🦡', ':swan:': '🦢', ':peacock:': '🦚',
    ':parrot:': '🦜', ':flamingo:': '🦩', ':dove:': '🕊️', ':poodle:': '🐩',
    ':cat2:': '🐈', ':rooster:': '🐓', ':turkey:': '🦃', ':dodo:': '🦤',
    ':penguin:': '🐧', ':feather:': '🪶', ':bone:': '🦴', ':blood:': '🩸',
    ':microbe:': '🦠', ':pill:': '💊', ':apple:': '🍎', ':green_apple:': '🍏',
    ':pear:': '🍐', ':tangerine:': '🍊', ':lemon:': '🍋', ':banana:': '🍌',
    ':watermelon:': '🍉', ':grapes:': '🍇', ':strawberry:': '🍓',
    ':blueberries:': '🫐', ':melon:': '🍈', ':cherries:': '🍒', ':peach:': '🍑',
    ':mango:': '🥭', ':pineapple:': '🍍', ':coconut:': '🥥', ':kiwi:': '🥝',
    ':tomato:': '🍅', ':eggplant:': '🍆', ':avocado:': '🥑', ':broccoli:': '🥦',
    ':leafy_green:': '🥬', ':herb:': '🌿', ':garlic:': '🧄', ':onion:': '🧅',
    ':mushroom:': '🍄', ':peanuts:': '🥜', ':chestnut:': '🌰', ':bread:': '🍞',
    ':croissant:': '🥐', ':baguette_bread:': '🥖', ':flatbread:': '🫓',
    ':pretzel:': '🥨', ':bagel:': '🥯', ':pancakes:': '🥞', ':waffle:': '🧇',
    ':cheese:': '🧀', ':meat_on_bone:': '🍖', ':poultry_leg:': '🍗',
    ':cut_of_meat:': '🥩', ':bacon:': '🥓', ':hamburger:': '🍔', ':fries:': '🍟',
    ':pizza:': '🍕', ':hotdog:': '🌭', ':sandwich:': '🥪', ':taco:': '🌮',
    ':burrito:': '🌯', ':tamale:': '🫔', ':stuffed_flatbread:': '🥙',
    ':falafel:': '🧆', ':egg:': '🥚', ':fried_egg:': '🍳', ':shallow_pan_of_food:': '🥘',
    ':stew:': '🍲', ':fondue:': '🫕', ':bowl_with_spoon:': '🥣',
    ':green_salad:': '🥗', ':popcorn:': '🍿', ':butter:': '🧈', ':salt:': '🧂',
    ':canned_food:': '🥫', ':bento:': '🍱', ':rice_cracker:': '🍘',
    ':rice_ball:': '🍙', ':rice:': '🍚', ':curry:': '🍛', ':ramen:': '🍜',
    ':spaghetti:': '🍝', ':sweet_potato:': '🍠', ':oden:': '🍢',
    ':sushi:': '🍣', ':fried_shrimp:': '🍤', ':fish_cake:': '🍥',
    ':moon_cake:': '🥮', ':dango:': '🍡', ':dumpling:': '🥟', ':fortune_cookie:': '🥠',
    ':takeout_box:': '🥡', ':crab:': '🦀', ':lobster:': '🦞', ':shrimp:': '🦐',
    ':squid:': '🦑', ':oyster:': '🦪', ':icecream:': '🍦', ':shaved_ice:': '🍧',
    ':ice_cream:': '🍨', ':doughnut:': '🍩', ':cookie:': '🍪', ':birthday:': '🎂',
    ':cake:': '🍰', ':cupcake:': '🧁', ':pie:': '🥧', ':chocolate_bar:': '🍫',
    ':candy:': '🍬', ':lollipop:': '🍭', ':custard:': '🍮', ':honey_pot:': '🍯',
    ':baby_bottle:': '🍼', ':milk_glass:': '🥛', ':coffee:': '☕',
    ':tea:': '🍵', ':mate:': '🧉', ':cup_with_straw:': '🥤', ':bubble_tea:': '🧋',
    ':sake:': '🍶', ':beer:': '🍺', ':beers:': '🍻', ':champagne_glass:': '🥂',
    ':wine_glass:': '🍷', ':tumbler_glass:': '🥃', ':cocktail:': '🍸',
    ':tropical_drink:': '🍹', ':champagne:': '🍾', ':ice_cube:': '🧊',
    ':spoon:': '🥄', ':fork_and_knife:': '🍴', ':fork_knife_plate:': '🍽️',
    ':bowl_with_spoon:': '🥣', ':takeout_box:': '🥡', ':chopsticks:': '🥢',
    ':earth_africa:': '🌍', ':earth_americas:': '🌎', ':earth_asia:': '🌏',
    ':globe_with_meridians:': '🌐', ':world_map:': '🗺️', ':map:': '🗺️',
    ':compass:': '🧭', ':mountain_snow:': '🏔️', ':mountain:': '⛰️',
    ':volcano:': '🌋', ':mount_fuji:': '🗻', ':camping:': '🏕️',
    ':beach_umbrella:': '🏖️', ':desert:': '🏜️', ':desert_island:': '🏝️',
    ':national_park:': '🏞️', ':stadium:': '🏟️', ':classical_building:': '🏛️',
    ':building_construction:': '🏗️', ':bricks:': '🧱', ':rock:': '🪨',
    ':wood:': '🪵', ':hut:': '🛖', ':houses:': '🏘️', ':derelict_house:': '🏚️',
    ':house:': '🏠', ':house_with_garden:': '🏡', ':office:': '🏢',
    ':post_office:': '🏣', ':european_post_office:': '🏤', ':hospital:': '🏥',
    ':bank:': '🏦', ':hotel:': '🏨', ':love_hotel:': '🏩', ':convenience_store:': '🏪',
    ':school:': '🏫', ':department_store:': '🏬', ':factory:': '🏭',
    ':japanese_castle:': '🏯', ':european_castle:': '🏰', ':wedding:': '💒',
    ':tokyo_tower:': '🗼', ':statue_of_liberty:': '🗽', ':sunrise:': '🌅',
    ':sunrise_over_mountains:': '🌄', ':city_sunrise:': '🌇', ':city_dusk:': '🌆',
    ':night_with_stars:': '🌃', ':sparkler:': '🎇', ':fireworks:': '🎆',
    ':milky_way:': '🌌', ':bridge_at_night:': '🌉', ':carousel_horse:': '🎠',
    ':ferris_wheel:': '🎡', ':roller_coaster:': '🎢', ':barber:': '💈',
    ':circus_tent:': '🎪', ':performing_arts:': '🎭', ':round_pushpin:': '📍',
    ':triangular_flag_on_post:': '🚩', ':crossed_flags:': '🎌',
    ':black_flag:': '🏴', ':white_flag:': '🏳️', ':rainbow_flag:': '🏳️‍🌈',
    ':transgender_flag:': '🏳️‍⚧️', ':checkered_flag:': '🏁', ':pineapple:': '🍍',
    ':red_car:': '🚗', ':taxi:': '🚕', ':blue_car:': '🚙', ':bus:': '🚌',
    ':trolleybus:': '🚎', ':race_car:': '🏎️', ':police_car:': '🚓',
    ':ambulance:': '🚑', ':fire_engine:': '🚒', ':minibus:': '🚐',
    ':truck:': '🚚', ':articulated_lorry:': '🚛', ':tractor:': '🚜',
    ':motorcycle:': '🏍️', ':bike:': '🚲', ':scooter:': '🛴',
    ':motor_scooter:': '🛵', ':busstop:': '🚏', ':motorway:': '🛣️',
    ':railway_track:': '🛤️', ':fuelpump:': '⛽', ':construction:': '🚧',
    ':anchor:': '⚓', ':sailboat:': '⛵', ':canoe:': '🛶', ':speedboat:': '🚤',
    ':passenger_ship:': '🛳️', ':ferry:': '⛴️', ':motor_boat:': '🛥️',
    ':ship:': '🚢', ':airplane:': '✈️', ':small_airplane:': '🛩️',
    ':airplane_departure:': '🛫', ':airplane_arriving:': '🛬',
    ':parachute:': '🪂', ':seat:': '💺', ':helicopter:': '🚁',
    ':suspension_railway:': '🚟', ':mountain_cableway:': '🚠',
    ':aerial_tramway:': '🚡', ':satellite:': '🛰️', ':rocket:': '🚀',
    ':flying_saucer:': '🛸', ':bellhop_bell:': '🛎️', ':door:': '🚪',
    ':elevator:': '🛗', ':bed:': '🛏️', ':couch_and_lamp:': '🛋️',
    ':toilet:': '🚽', ':shower:': '🚿', ':bathtub:': '🛁', ':broom:': '🧹',
    ':basket:': '🧺', ':roll_of_paper:': '🧻', ':soap:': '🧼',
    ':sponge:': '🧽', ':fire_extinguisher:': '🧯', ':shopping_cart:': '🛒',
    ':shopping_bags:': '🛍️', ':gift:': '🎁', ':balloon:': '🎈',
    ':flags:': '🎏', ':ribbon:': '🎀', ':confetti_ball:': '🎊',
    ':tada:': '🎉', ':dolls:': '🎎', ':izakaya_lantern:': '🏮',
    ':wind_chime:': '🎐', ':envelope_with_arrow:': '📩',
    ':love_letter:': '💌', ':inbox_tray:': '📥', ':outbox_tray:': '📤',
    ':briefcase:': '💼', ':file_folder:': '📁', ':open_file_folder:': '📂',
    ':spiral_note_pad:': '🗒️', ':spiral_calendar:': '🗓️', ':card_index:': '📇',
    ':chart_with_upwards_trend:': '📈', ':chart_with_downwards_trend:': '📉',
    ':bar_chart:': '📊', ':clipboard:': '📋', ':pushpin:': '📌',
    ':round_pushpin:': '📍', ':paperclip:': '📎', ':straight_ruler:': '📏',
    ':triangular_ruler:': '📐', ':scissors:': '✂️', ':pen:': '🖊️',
    ':fountain_pen:': '🖋️', ':paintbrush:': '🖌️', ':crayon:': '🖍️',
    ':memo:': '📝', ':pencil:': '✏️', ':black_nib:': '✒️',
    ':lock_with_ink_pen:': '🔏', ':closed_lock_with_key:': '🔐', ':lock:': '🔒',
    ':unlock:': '🔓', ':heart:': '❤️', ':yellow_heart:': '💛',
    ':green_heart:': '💚', ':blue_heart:': '💙', ':purple_heart:': '💜',
    ':black_heart:': '🖤', ':broken_heart:': '💔', ':two_hearts:': '💕',
    ':revolving_hearts:': '💞', ':heartbeat:': '💓', ':heartpulse:': '💗',
    ':sparkling_heart:': '💖', ':cupid:': '💘', ':gift_heart:': '💝',
    ':heart_decoration:': '💟', ':peace_symbol:': '☮️',
    ':latin_cross:': '✝️', ':star_and_crescent:': '☪️', ':om:': '🕉️',
    ':wheel_of_dharma:': '☸️', ':six_pointed_star:': '🔯', ':menorah:': '🕎',
    ':yin_yang:': '☯️', ':orthodox_cross:': '☦️', ':place_of_worship:': '🛐',
    ':atom_symbol:': '⚛️', ':transgender_symbol:': '⚧️',
    ':female_sign:': '♀️', ':male_sign:': '♂️', ':medical_symbol:': '⚕️',
    ':infinity:': '♾️', ':recycling_symbol:': '♻️', ':fleur_de_lis:': '⚜️',
    ':trident:': '🔱', ':name_badge:': '📛', ':beginner:': '🔰', ':o:': '⭕',
    ':white_check_mark:': '✅', ':heavy_check_mark:': '✔️', ':x:': '❌',
    ':negative_squared_cross_mark:': '❎', ':curly_loop:': '➰', ':loop:': '➿',
    ':part_alternation_mark:': '〽️', ':eight_spoked_asterisk:': '✳️',
    ':eight_pointed_black_star:': '✴️', ':sparkle:': '❇️', ':copyright:': '©️',
    ':registered:': '®️', ':tm:': '™️'
  };

  let originalContent = ''; // 用于存储文件打开时的原始内容，支持“重置”功能

  // 【新增】全局映射表：存储 { "原始文本": "heading-x" }
  let headingIdMap = {};

   /**
   * 【公共函数】通用外部库加载器 (Fetch + Blob 模式，兼容 CSP)
   * @param {string} url - 脚本或样式表的 URL (优先使用本地 chrome.runtime.getURL)
   * @param {boolean} isCss - 是否为 CSS 文件
   * @returns {Promise<void>}
   */
  async function loadExternalLib(url, isCss = false) {
    return new Promise(async (resolve, reject) => {
      try {
        // 1. 尝试 Fetch 获取内容 (绕过 CSP 对 script-src 的限制)
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        
        const content = await response.text();

        if (isCss) {
          // 2a. 处理 CSS: 创建 Style 标签
          const style = document.createElement('style');
          style.textContent = content;
          document.head.appendChild(style);
          resolve();
        } else {
          // 2b. 处理 JS: 创建 Blob URL 并插入 Script 标签
          const blob = new Blob([content], { type: 'application/javascript' });
          const blobUrl = URL.createObjectURL(blob);
          
          const script = document.createElement('script');
          script.src = blobUrl;
          
          script.onload = () => {
            URL.revokeObjectURL(blobUrl); // 清理内存
            resolve();
          };
          
          script.onerror = (e) => {
            URL.revokeObjectURL(blobUrl);
            reject(new Error(`Script execution failed for ${url}`));
          };
          
          document.head.appendChild(script);
        }
      } catch (error) {
        console.warn(`Failed to load lib from ${url}, trying fallback if available...`, error);
        reject(error);
      }
    });
  }

  /**
   * 动态加载 Mermaid 库
   * 优先使用 manifest 预加载的全局变量，否则通过 loadExternalLib 动态加载
   * @returns {Promise<Object>} Mermaid 实例对象
   */
  async function loadMermaid() {
    if (mermaidLoaded && mermaidInstance) return mermaidInstance;
    
    // 如果全局已存在（例如通过 manifest 预加载），直接使用
    if (window.mermaid) {
      console.log('Using existing mermaid instance...');
      mermaidInstance = window.mermaid;
      mermaidLoaded = true;
      if (!mermaidInstance.__initialized) {
        mermaidInstance.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
        mermaidInstance.__initialized = true;
      }
      return mermaidInstance;
    }

    // 否则动态加载
    try {
      console.log('loadExternalLib Loading Mermaid...');
      await loadExternalLib(LIBS.mermaid.local);
      
      if (window.mermaid) {
        mermaidInstance = window.mermaid;
        mermaidLoaded = true;
        mermaidInstance.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
        mermaidInstance.__initialized = true;
        return mermaidInstance;
      } else {
        throw new Error('Mermaid global object not found after loading');
      }
    } catch (e) {
      console.error('Mermaid load error:', e);
      throw e;
    }

  }

  /**
   * 动态加载 KaTeX
   * 按顺序加载 CSS -> katex.js -> auto-render.js
   * @returns {Promise<void>}
   */
  async function loadKaTeX() {
    if (katexLoaded) return;
    if (window.katex && window.renderMathInElement) {
      katexLoaded = true;
      console.log('KaTeX already initialized.');
      return;
    }
    try {
      // 按顺序加载：先 CSS，再 katex.js，最后 auto-render.js
      console.log('Loading KaTeX...');
      await loadExternalLib(LIBS.katexCss.local, true);
      await loadExternalLib(LIBS.katexJs.local);
      
      // 验证 katex 是否完全加载，包括 ParseError
      if (!window.katex || typeof window.katex.ParseError === 'undefined') {
        throw new Error('KaTeX loaded but ParseError is undefined');
      }
      
      await loadExternalLib(LIBS.katexAutoRender.local);
      
      // 验证 auto-render 是否加载成功
      if (typeof window.renderMathInElement !== 'function') {
        throw new Error('auto-render.min.js loaded but renderMathInElement is not available');
      }
      
      katexLoaded = true;
      console.log('KaTeX initialized successfully.');
    } catch (e) {
      console.error('KaTeX load error:', e);
      throw e;
    }
  }

  // ==========================================
  // 2. 核心工具函数
  // ==========================================

  /**
   * 检测当前页面是否为 Markdown 文件
   * @returns {boolean}
   */
  function isMarkdownFile() {
    const pathname = window.location.pathname;
    // 1. 检查路径后缀
    if (pathname.endsWith('.md') || pathname.endsWith('.markdown')) return true;
    
    // 2. 检查 MIME 类型
    const contentType = document.contentType;
    if (contentType && (contentType.includes('text/markdown') || contentType.includes('text/x-markdown'))) return true;

    // 【优先】兼容开发模式：如果存在 raw-md 元素且有内容，直接视为 Markdown
    const rawMd = document.getElementById('raw-md');
    if (rawMd && rawMd.textContent.trim().length > 0) {
        return true;
    }

    // 3. 【新增】排除已知非 Markdown 文件扩展名
    const extMatch = pathname.match(/\.([a-zA-Z0-9]+)$/);
    if (extMatch) {
      const knownNonMdExts = ['js', 'json', 'css', 'html', 'htm', 'xml', 'txt', 'csv', 'ts', 'py', 'java', 'c', 'cpp', 'h', 'php', 'rb', 'go', 'rs', 'sh', 'yaml', 'yml', 'toml', 'ini', 'log', 'sql', 'bat', 'cmd', 'ps1', 'jsx', 'tsx', 'vue', 'scss', 'sass', 'less'];
      if (knownNonMdExts.includes(extMatch[1].toLowerCase())) {
        return false;
      }
    }

    // 4. 【新增】排除已知非 Markdown MIME 类型
    if (contentType) {
      const nonMdTypes = ['javascript', 'css', 'html', 'json', 'xml', 'csv'];
      if (nonMdTypes.some(type => contentType.includes(type))) {
        return false;
      }
    }

    // 5. 【保留】兼容本地测试：如果 body 下有非空的 pre 标签（排除 raw-md）且没有插件 UI，也视为 md 文件
    const bodyPre = document.querySelector('body > pre');
    if (bodyPre && bodyPre.id !== 'raw-md' && bodyPre.textContent.trim().length > 0 && !document.getElementById('md-viewer-header')) {
        return true;
    }

    return false;
  }

  /**
   * 从页面中提取原始的 Markdown 文本
   * 通常浏览器打开 .md 文件时，内容会包裹在 <pre> 或 <code> 标签中
   * @returns {string}
   */
  function getRawText() {
    // 如果有外部传入的内容（如最近文件切换），优先使用
    if (window.__mdRawContent) {
      return window.__mdRawContent;
    }

    // 开发模式下优先使用 raw-md 元素
    const rawMd = document.getElementById('raw-md');
    if (rawMd) return rawMd.textContent;

    const preElement = document.querySelector('pre');
    if (preElement) return preElement.textContent;

    const codeElement = document.querySelector('code');
    if (codeElement) return codeElement.textContent;

    return document.body.innerText;
  }

  /**
   * 解析 Markdown 文本为 HTML，并处理 Mermaid 图表
   * @param {string} text - 原始 Markdown 文本
   * @returns {Promise<string>} - 渲染后的 HTML 字符串
   */
  async function parseMarkdown(text) {
    try {
      // 第一步：将 Markdown 转换为 HTML 并进行安全过滤
      const rawHtml = await marked.parse(text);
      const cleanHtml = DOMPurify.sanitize(rawHtml);
      
      // 第二步：创建临时 DOM 容器以便操作节点
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cleanHtml;

      // 2.5 Emoji 短代码替换（排除 code、pre 等标签内部）
      if (CONFIG.enableEmoji) {
        const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (parent && (parent.tagName === 'CODE' || parent.tagName === 'PRE' || parent.closest('code, pre'))) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        });
        const textNodes = [];
        let node;
        while ((node = walker.nextNode()) !== null) {
          textNodes.push(node);
        }
        textNodes.forEach(node => {
          const newText = node.textContent.replace(/:[a-zA-Z0-9_+-]+:/g, match => {
            return EMOJI_MAP[match] || match;
          });
          if (newText !== node.textContent) {
            node.textContent = newText;
          }
        });
      }
      
      // 第三步：如果启用了 Mermaid，查找并渲染代码块
      if (CONFIG.enableMermaid) {
        // 查找所有语言标记为 mermaid 的代码块
        const codeBlocks = tempDiv.querySelectorAll('pre code.language-mermaid');
        if (codeBlocks.length > 0) {
          // 确保 Mermaid 已加载
          await loadMermaid();
          for (let i = 0; i < codeBlocks.length; i++) {
            const block = codeBlocks[i];
            const graphDefinition = block.textContent;
            // 生成唯一 ID，避免 Mermaid 渲染冲突
            const id = `mermaid-${Date.now()}-${i}`;
            
            try {
              // 调用 Mermaid API 渲染 SVG
              const { svg } = await mermaidInstance.render(id, graphDefinition);
              const pre = block.parentElement;
              
              // 创建包装容器
              const wrapper = document.createElement('div');
              wrapper.className = 'md-mermaid-block';
              
              // 创建顶部工具栏
              const header = document.createElement('div');
              header.className = 'md-mermaid-header';
              
              // 类型标签（左侧）
              const typeLabel = document.createElement('span');
              typeLabel.className = 'md-mermaid-type';
              typeLabel.textContent = 'Mermaid';
              header.appendChild(typeLabel);
              
              // 操作按钮容器（右侧）
              const actions = document.createElement('div');
              actions.className = 'md-mermaid-actions';
              
              // 源码/渲染切换按钮
              const toggleBtn = document.createElement('button');
              toggleBtn.className = 'md-mermaid-toggle';
              toggleBtn.textContent = '源码';
              toggleBtn.type = 'button';
              actions.appendChild(toggleBtn);
              
              // 复制 MD 按钮
              const copyBtn = document.createElement('button');
              copyBtn.className = 'md-copy-mermaid-btn';
              copyBtn.textContent = '复制 MD';
              copyBtn.type = 'button';
              actions.appendChild(copyBtn);
              
              // 下载下拉菜单容器
              const downloadContainer = document.createElement('div');
              downloadContainer.className = 'md-mermaid-download';
              
              const downloadTrigger = document.createElement('button');
              downloadTrigger.className = 'md-mermaid-download-trigger';
              downloadTrigger.textContent = '下载 ▼';
              downloadTrigger.type = 'button';
              downloadContainer.appendChild(downloadTrigger);
              
              const downloadMenu = document.createElement('div');
              downloadMenu.className = 'md-mermaid-download-menu';
              
              const downloadPng = document.createElement('div');
              downloadPng.className = 'md-mermaid-download-item';
              downloadPng.textContent = 'PNG';
              downloadPng.setAttribute('data-format', 'png');
              downloadMenu.appendChild(downloadPng);
              
              const downloadSvg = document.createElement('div');
              downloadSvg.className = 'md-mermaid-download-item';
              downloadSvg.textContent = 'SVG';
              downloadSvg.setAttribute('data-format', 'svg');
              downloadMenu.appendChild(downloadSvg);
              
              downloadContainer.appendChild(downloadMenu);
              actions.appendChild(downloadContainer);
              
              header.appendChild(actions);
              
              // 源码显示区域（默认隐藏）
              const sourceArea = document.createElement('textarea');
              sourceArea.className = 'md-mermaid-source';
              sourceArea.textContent = '```mermaid\n' + graphDefinition + '\n```';
              sourceArea.readOnly = true;
              
              // 图表容器
              const diagramDiv = document.createElement('div');
              diagramDiv.className = 'mermaid-diagram';
              diagramDiv.innerHTML = svg;
              
              wrapper.appendChild(header);
              wrapper.appendChild(diagramDiv);
              wrapper.appendChild(sourceArea);
              
              // 替换原有的代码块为渲染后的图表
              pre.replaceWith(wrapper);
            } catch (e) {
              console.error('Mermaid render error:', e);
              // 渲染失败时保留原始代码块或显示错误提示
              block.parentElement.innerHTML = `<div class="md-error">Mermaid 语法错误</div>`;
            }
          }
        }
        
      }
      // 2. 处理外部链接：为所有外部链接添加 target="_blank" 和 rel="noopener noreferrer"
      const links = tempDiv.querySelectorAll('a');
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
        }
      });

      // 3. 处理数学公式 (KaTeX)
      if (CONFIG.enableMath) {
        // 确保 KaTeX 已加载
        if (!katexLoaded) {
          await loadKaTeX();
        }

        // 使用 KaTeX 的 auto-render 扩展自动查找 $...$ 和 $$...$$
        if (typeof window.renderMathInElement === 'function') {
          window.renderMathInElement(tempDiv, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\(', right: '\\)', display: false },
              { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false
          });
        }

      }

      // 4. 图片懒加载：为所有图片添加 loading="lazy"
      const images = tempDiv.querySelectorAll('img');
      images.forEach(img => {
        img.setAttribute('loading', 'lazy');
      });

      return tempDiv.innerHTML;
    } catch (error) {
      console.error('Parsing error:', error);
      return `<div class="md-error">解析错误: ${error.message}</div>`;
    }
  }

  /**
   * 为页面中的标题添加 ID，并生成目录 HTML
   * @param {HTMLElement} contentContainer - 包含预览内容的容器
   * @returns {string} - TOC 的 HTML 字符串
   */
  function processHeadersAndGenerateTOC(contentContainer) {
    if (!CONFIG.enableTOC) return '';
    
    // 重置映射表
    headingIdMap = {};

    // 【修改】扩大选择范围，支持 h1 到 h6
    const headers = contentContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    if (headers.length === 0) return '';

    let tocHtml = '<div class="md-toc"><div class="md-toc-header"><h3>📑 目录</h3><button class="md-toc-toggle" title="收起/展开目录" type="button">◀</button></div><ul>';
    headers.forEach((header, index) => {
      // 【关键修复】直接在真实的 DOM 元素上设置 ID
      const id = `heading-${index}`;
      // 【关键】设置 id 前保存滚动位置，防止浏览器因 hash 匹配自动滚动
      const contentAreaScroll = document.getElementById('md-content-area');
      const savedScrollTop = contentAreaScroll ? contentAreaScroll.scrollTop : window.scrollY;
      header.id = id;
      if (contentAreaScroll) {
        contentAreaScroll.scrollTo({ top: savedScrollTop });
      } else {
        window.scrollTo(0, savedScrollTop);
      } 
      
      // 【关键】建立映射：去除首尾空格后的文本 -> 新 ID
      const text = header.textContent.trim();
      headingIdMap[text] = id;

      const level = parseInt(header.tagName.substring(1));
      // 【修改】优化缩进逻辑，每层增加 12px，最大不超过 60px 防止过宽
      const indent = Math.min((level - 1) * 12, 60);
      
      tocHtml += `<li style="margin-left: ${indent}px; margin-bottom: 4px; font-size: ${14 - (level - 1)}px;">
        <a href="javascript:void(0)" class="toc-link" data-target="${id}" title="${header.textContent}">
          ${header.textContent}
        </a>
      </li>`;
    });
    tocHtml += '</ul></div>';
    return tocHtml;
  }

  /**
   * 根据 HTML 内容生成目录 (TOC)
   * @param {string} htmlContent - 已渲染的 HTML 内容
   * @returns {string} - TOC 的 HTML 字符串
   */
  function generateTOC(htmlContent) {
    if (!CONFIG.enableTOC) return '';
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    // 【修改】扩大选择范围
    const headers = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    if (headers.length === 0) return '';

    let tocHtml = '<div class="md-toc"><h3>📑 目录</h3><ul>';
    headers.forEach((header, index) => {
      // 为每个标题生成唯一 ID，用于锚点跳转
      const id = `heading-${index}`;
      header.id = id; 
      
      const level = parseInt(header.tagName.substring(1));
      // 根据标题层级设置缩进
      const indent = Math.min((level - 1) * 12, 60);
      
      tocHtml += `<li style="margin-left: ${indent}px; margin-bottom: 4px; font-size: ${14 - (level - 1)}px;">
        <a href="#${id}" class="toc-link" data-target="${id}" title="${header.textContent}">
          ${header.textContent}
        </a>
      </li>`;
    });
    tocHtml += '</ul></div>';
    return tocHtml;
  }

  // ==========================================
  // 3. UI 构建与渲染
  // ==========================================

  /**
   * 创建插件的主界面结构
   * @returns {Object} 包含主要 DOM 元素的引用对象
   */
  function createUI() {
    // 1. 顶部工具栏
    const toolbar = document.createElement('div');
    toolbar.id = 'md-viewer-header';
    
    let buttonsHtml = `
      <button id="md-toggle-btn" class="md-btn active">👁️ 预览</button>
      <button id="md-copy-btn" class="md-btn">📋 复制</button>
      <button id="md-download-btn" class="md-btn">💾 下载</button>
      <button id="md-theme-btn" class="md-btn">🌙 暗色</button>
      <button id="md-fullscreen-btn" class="md-btn">⛶ 全屏</button>
      <button id="md-more-btn" class="md-btn">📑 更多 </button>
    `;

    // 如果开启了编辑器功能，添加编辑和重置按钮
    if (CONFIG.enableEditor) {
      buttonsHtml += `<button id="md-edit-btn" class="md-btn">✏️ 编辑</button>`;
      buttonsHtml += `<button id="md-reset-btn" class="md-btn" style="display:none;">↩️ 重置</button>`;
    }

    toolbar.innerHTML = `
      <div class="md-viewer-controls">
        ${buttonsHtml}
        <span class="md-file-name" id="md-file-name"></span>
      </div>
      <div class="md-reading-progress"><div class="md-reading-progress-bar" id="md-reading-progress-bar"></div></div>
    `;

    // 2. 主容器（采用 Flex 布局：左侧 TOC + 右侧内容）
    const mainContainer = document.createElement('div');
    mainContainer.id = 'md-viewer-main';
    
    // 左侧目录侧边栏
    const tocContainer = document.createElement('div');
    tocContainer.id = 'md-viewer-toc';
    
    // 右侧内容区域
    const contentArea = document.createElement('div');
    contentArea.id = 'md-content-area';

    // 加载动画容器
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'md-loading-overlay';
    loadingOverlay.innerHTML = `
      <div class="md-spinner"></div>
      <div class="md-loading-text">正在渲染 Markdown...</div>
    `;

    // 预览视图容器
    const previewContainer = document.createElement('div');
    previewContainer.id = 'md-preview-container';
    
    // 编辑视图容器（Textarea）
    const editorContainer = document.createElement('textarea');
    editorContainer.id = 'md-editor-container';
    editorContainer.placeholder = "在此输入 Markdown 内容...";
    editorContainer.style.display = 'none'; // 默认隐藏

    contentArea.appendChild(loadingOverlay);
    contentArea.appendChild(previewContainer);
    contentArea.appendChild(editorContainer);

    mainContainer.appendChild(tocContainer);
    mainContainer.appendChild(contentArea);

    // 3. 底部信息栏（Footer）
    const footerContainer = document.createElement('div');
    footerContainer.id = 'md-viewer-footer';
    footerContainer.className = 'md-footer-container';
    footerContainer.innerHTML = `
      <div class="md-footer-left">
        <span>MD Viewer</span>
      </div>
      <div class="md-footer-right">
        <span id="md-word-count">0</span> 字 | <span id="md-reading-time">0</span> 分钟阅读
      </div>
    `;

    // 将 UI 插入到 body 中
    document.body.insertBefore(toolbar, document.body.firstChild);
    document.body.insertBefore(mainContainer, document.body.firstChild.nextSibling);
    document.body.appendChild(footerContainer);

    // 更多菜单
    const moreMenu = document.createElement('div');
    moreMenu.id = 'md-more-menu';
    moreMenu.className = 'md-more-menu';
    moreMenu.innerHTML = `
      <div class="md-more-item" data-action="screenshot-auto">
        <span class="md-more-item-label">📷 自动截图</span>
        <span class="md-more-item-shortcut"></span>
      </div>
      <div class="md-more-item" data-action="screenshot-manual">
        <span class="md-more-item-label">✂️ 手动截图</span>
        <span class="md-more-item-shortcut"></span>
      </div>
      <div class="md-more-item" data-action="search">
        <span class="md-more-item-label">🔍 搜索</span>
        <span class="md-more-item-shortcut">Ctrl+F</span>
      </div>
      <div class="md-more-item" data-action="shortcuts">
        <span class="md-more-item-label">⌨️ 快捷键</span>
        <span class="md-more-item-shortcut"></span>
      </div>
      <div class="md-more-item md-more-submenu-trigger" data-action="recent">
        <span class="md-more-item-label">📁 最近文件</span>
        <span class="md-more-item-arrow">▶</span>
        <div class="md-more-submenu" id="md-recent-submenu"></div>
      </div>
    `;
    document.body.appendChild(moreMenu);

    return { toolbar, tocContainer, previewContainer, editorContainer, loadingOverlay };
  }

  /**
   * 主渲染入口函数
   * 检测当前页面是否为 Markdown 文件，创建 UI 并渲染预览
   * @returns {Promise<void>}
   */
  async function renderMarkdown() {
    if (!isMarkdownFile()) return;

    // 【关键】页面渲染前强制回到顶部，防止浏览器基于原始内容恢复滚动位置
    const contentAreaTop = document.getElementById('md-content-area');
    if (contentAreaTop) {
      contentAreaTop.scrollTo({ top: 0 });
    } else {
      window.scrollTo(0, 0);
    }

    // 清除已有 UI，防止重复创建（开发模式下多次加载时有用）
    const existingToolbar = document.getElementById('md-viewer-header');
    const existingMain = document.getElementById('md-viewer-main');
    const existingFooter = document.getElementById('md-viewer-footer');
    const existingMoreMenu = document.getElementById('md-more-menu');
    if (existingToolbar) existingToolbar.remove();
    if (existingMain) existingMain.remove();
    if (existingFooter) existingFooter.remove();
    if (existingMoreMenu) existingMoreMenu.remove();

    console.log('MD Viewer: Markdown file detected.');

    // 预加载 KaTeX (如果开启了数学公式支持)
    if (CONFIG.enableMath) {
      loadKaTeX().catch(err => console.error('KaTeX load failed:', err));
    }
    
    // 获取原始内容并保存
    const rawText = getRawText();

    // 开发模式下：内容为空时不渲染，等待用户上传文件
    if (!rawText || rawText.trim().length === 0) {
      console.log('MD Viewer: raw content is empty, skipping render.');
      return;
    }

    originalContent = rawText; 
    window.__mdRawContent = rawText;
    
    // 【修改】处理中文文件名乱码：先获取路径，再解码
    let fileName = window.__mdFileName || window.location.pathname.split('/').pop() || 'untitled.md';
    try {
      fileName = decodeURIComponent(fileName);
    } catch (e) {
      console.warn('Filename decode error', e);
    }
    window.__mdFileName = fileName;

    // 创建界面
    const { tocContainer, previewContainer, editorContainer, loadingOverlay } = createUI();
    
    // 设置文件名显示
    document.getElementById('md-file-name').textContent = window.__mdFileName;
    // 保存到最近文件列表
    // 开发模式下使用文件名作为 path，避免所有文件共享同一个 window.location.href
    const isDevMode = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const filePath = isDevMode ? window.__mdFileName : window.location.href;
    addRecentFile(filePath, window.__mdFileName, window.__mdRawContent);
    editorContainer.value = rawText;

    // 执行首次渲染
    try {
      const html = await parseMarkdown(rawText);
      previewContainer.innerHTML = html;
      addCodeCopyButtons(previewContainer);
      addTableActions(previewContainer);
      applyHighlighting(previewContainer);
      initImageLightbox(previewContainer);
    } finally {
      // 渲染完成后隐藏 loading（无论成功或失败）
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }
    
    // 生成目录
    if (CONFIG.enableTOC) {
      // tocContainer.innerHTML = generateTOC(html); 
      // 【关键修复】在内容已经插入 DOM 后，再处理标题 ID 并生成目录
      const tocHtml = processHeadersAndGenerateTOC(previewContainer);
      tocContainer.innerHTML = tocHtml;
      
      // 绑定目录点击事件（使用事件委托）
      tocContainer.addEventListener('click', (e) => {
        const link = e.target.closest('.toc-link');
        if (link) {
          e.preventDefault();
          // 设置标志位，暂时禁用滚动监听，避免闪烁
          window.__isClickingTOC = true;
          
          // 【新增】处理选中状态
          const allLinks = tocContainer.querySelectorAll('.toc-link');
          allLinks.forEach(l => l.classList.remove('active'));
          link.classList.add('active');

          const targetId = e.target.getAttribute('data-target');
          const targetEl = document.getElementById(targetId);
          if (targetEl) {
            // 保存当前选中目录，刷新后恢复位置
            sessionStorage.setItem('md-viewer-last-heading', targetId);
            // 滚动到指定元素
            const contentArea = document.getElementById('md-content-area');
            if (contentArea) {
              const offsetTop = targetEl.offsetTop - 70;
              contentArea.scrollTo({ top: offsetTop, behavior: 'smooth' });
            } else {
              targetEl.scrollIntoView({ behavior: 'smooth' });
            }
          }
          
          // 延迟清除标志位（等待平滑滚动完成）
          setTimeout(() => {
            window.__isClickingTOC = false;
          }, 1000);
        }
      });
    }

    // 绑定交互事件
    bindEvents(previewContainer, editorContainer, rawText);

    // 初始化搜索功能和回到顶部按钮
    initSearchBox();
    initScrollTopButton();

    // 更新字数统计
    updateWordCount(rawText);

    // 恢复上次浏览位置（页面加载时瞬间跳转，不使用动画）
    const contentArea = document.getElementById('md-content-area');
    const savedHeadingId = sessionStorage.getItem('md-viewer-last-heading');
    if (savedHeadingId) {
      const targetEl = document.getElementById(savedHeadingId);
      if (targetEl && contentArea) {
        const offsetTop = targetEl.offsetTop - 70;
        contentArea.scrollTo({ top: offsetTop, behavior: 'auto' });
      } else if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
      sessionStorage.removeItem('md-viewer-last-heading');
    } else {
      // 没有记录时回到顶部（防止浏览器基于原始内容恢复到底部）
      if (contentArea) {
        contentArea.scrollTo({ top: 0, behavior: 'auto' });
      } else {
        window.scrollTo(0, 0);
      }
    }

    // 隐藏浏览器默认的原始内容显示
    hideOriginalContent();
  }

  /**
   * 隐藏浏览器原生渲染的 <pre> 或 <code> 标签
   */
  function hideOriginalContent() {
    const pre = document.querySelector('body > pre');
    const code = document.querySelector('body > code');
    if (pre) pre.style.display = 'none';
    if (code) code.style.display = 'none';
    
    // 清理 body 下直接的文本节点
    document.body.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        node.textContent = '';
      }
    });
  }

  /**
   * 为代码块添加顶部工具栏（语言标签 + 操作按钮）和源码/渲染切换功能
   * @param {HTMLElement} previewContainer - 包含渲染后内容的容器元素
   */
  function addCodeCopyButtons(previewContainer) {
    const codeBlocks = previewContainer.querySelectorAll('pre');
    codeBlocks.forEach(pre => {
      // 避免重复添加
      if (pre.parentElement && pre.parentElement.classList.contains('md-code-block')) {
        return;
      }
      const wrapper = document.createElement('div');
      wrapper.className = 'md-code-block';
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      // 获取代码块的语言标识
      const codeEl = pre.querySelector('code');
      let lang = '';
      if (codeEl) {
        const langMatch = codeEl.className.match(/language-(\w+)/);
        if (langMatch) {
          lang = langMatch[1];
        }
      }

      // 创建原始 Markdown 文本（包含 ``` 包裹）
      const rawCodeText = codeEl ? codeEl.textContent : '';
      const mdSource = '\`\`\`' + lang + '\n' + rawCodeText + '\n\`\`\`';
      wrapper.setAttribute('data-md-source', mdSource);

      // 顶部工具栏
      const header = document.createElement('div');
      header.className = 'md-code-header';

      // 语言标签（左侧）
      const langLabel = document.createElement('span');
      langLabel.className = 'md-code-lang';
      langLabel.textContent = lang || 'code';
      header.appendChild(langLabel);

      // 操作按钮容器（右侧）
      const actions = document.createElement('div');
      actions.className = 'md-code-actions';

      // 源码/渲染切换按钮
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'md-code-toggle';
      toggleBtn.textContent = '源码';
      toggleBtn.type = 'button';
      actions.appendChild(toggleBtn);

      // 复制 MD 格式按钮
      const mdBtn = document.createElement('button');
      mdBtn.className = 'md-copy-md-btn';
      mdBtn.textContent = '复制 MD';
      mdBtn.type = 'button';
      actions.appendChild(mdBtn);

      // 复制纯代码按钮
      const btn = document.createElement('button');
      btn.className = 'md-copy-code-btn';
      btn.textContent = '复制';
      btn.type = 'button';
      actions.appendChild(btn);

      // 代码块折叠按钮（超过 15 行显示）
      const lineCount = rawCodeText.split('\n').length;
      if (lineCount > 15) {
        const foldBtn = document.createElement('button');
        foldBtn.className = 'md-code-fold-btn';
        foldBtn.textContent = '展开';
        foldBtn.type = 'button';
        actions.appendChild(foldBtn);
      }

      header.appendChild(actions);
      wrapper.insertBefore(header, pre);

      // 源码显示区域（默认隐藏）
      const sourceArea = document.createElement('textarea');
      sourceArea.className = 'md-code-source';
      sourceArea.value = mdSource;
      sourceArea.readOnly = true;
      wrapper.appendChild(sourceArea);

      // 代码块折叠遮罩（超过 15 行时添加）
      if (lineCount > 15) {
        const foldOverlay = document.createElement('div');
        foldOverlay.className = 'md-code-fold-overlay';
        wrapper.appendChild(foldOverlay);
        pre.style.maxHeight = '300px';
        pre.style.overflow = 'hidden';
      }
    });
  }

  /**
   * 从 Markdown 文本中提取所有表格源码
   * @param {string} mdText - 原始 Markdown 文本
   * @returns {string[]} 表格源码字符串数组
   */
  function extractMarkdownTables(mdText) {
    if (!mdText) return [];
    const lines = mdText.split('\n');
    const tables = [];
    let currentTable = [];

    for (const line of lines) {
      if (line.trim().startsWith('|')) {
        currentTable.push(line);
      } else {
        if (currentTable.length >= 2) {
          tables.push(currentTable.join('\n'));
        }
        currentTable = [];
      }
    }

    if (currentTable.length >= 2) {
      tables.push(currentTable.join('\n'));
    }

    return tables;
  }

  /**
   * 为表格添加顶部工具栏（类型标签 + 操作按钮）
   * @param {HTMLElement} previewContainer - 包含渲染后内容的容器元素
   */
  function addTableActions(previewContainer) {
    const tables = previewContainer.querySelectorAll('table');
    const tableSources = extractMarkdownTables(window.__mdRawContent || '');

    tables.forEach((table, index) => {
      // 避免重复添加
      if (table.parentElement && table.parentElement.classList.contains('md-table-block')) {
        return;
      }
      const wrapper = document.createElement('div');
      wrapper.className = 'md-table-block';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);

      // 获取原始 Markdown 表格源码
      const mdSource = tableSources[index] || '';
      wrapper.setAttribute('data-md-source', mdSource);

      // 顶部工具栏
      const header = document.createElement('div');
      header.className = 'md-table-header';

      // 类型标签（左侧）
      const typeLabel = document.createElement('span');
      typeLabel.className = 'md-table-type';
      typeLabel.textContent = 'Table';
      header.appendChild(typeLabel);

      // 操作按钮容器（右侧）
      const actions = document.createElement('div');
      actions.className = 'md-table-actions';

      // 源码/渲染切换按钮
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'md-table-toggle';
      toggleBtn.textContent = '源码';
      toggleBtn.type = 'button';
      actions.appendChild(toggleBtn);

      // 复制按钮
      const copyBtn = document.createElement('button');
      copyBtn.className = 'md-copy-table-btn';
      copyBtn.textContent = '复制';
      copyBtn.type = 'button';
      actions.appendChild(copyBtn);

      // 下载 CSV 按钮
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'md-download-csv-btn';
      downloadBtn.textContent = '下载 CSV';
      downloadBtn.type = 'button';
      actions.appendChild(downloadBtn);

      // 下载 Excel 按钮
      const downloadExcelBtn = document.createElement('button');
      downloadExcelBtn.className = 'md-download-excel-btn';
      downloadExcelBtn.textContent = '下载 Excel';
      downloadExcelBtn.type = 'button';
      actions.appendChild(downloadExcelBtn);

      header.appendChild(actions);
      wrapper.insertBefore(header, table);

      // 源码显示区域（默认隐藏）
      const sourceArea = document.createElement('textarea');
      sourceArea.className = 'md-table-source';
      sourceArea.value = mdSource;
      sourceArea.readOnly = true;
      wrapper.appendChild(sourceArea);
    });
  }

  /**
   * 将 HTML 表格数据转换为 CSV 字符串
   * @param {HTMLTableElement} table - HTML 表格元素
   * @returns {string} CSV 格式字符串
   */
  function tableToCSV(table) {
    const rows = table.querySelectorAll('tr');
    const csvLines = [];
    rows.forEach(row => {
      const cells = row.querySelectorAll('th, td');
      const rowData = [];
      cells.forEach(cell => {
        let text = cell.textContent.trim();
        // 处理包含逗号、引号或换行的单元格
        if (text.includes(',') || text.includes('"') || text.includes('\n')) {
          text = '"' + text.replace(/"/g, '""') + '"';
        }
        rowData.push(text);
      });
      csvLines.push(rowData.join(','));
    });
    return csvLines.join('\n');
  }

  /**
   * 下载 SVG 内容为文件
   * @param {SVGElement} svgElement - SVG 元素
   * @param {string} [filename='diagram.svg'] - 下载文件名
   */
  function downloadSVG(svgElement, filename) {
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'diagram.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 将 SVG 转换为 PNG 并下载
   * @param {SVGElement} svgElement - SVG 元素
   * @param {string} [filename='diagram.png'] - 下载文件名
   */
  function downloadPNG(svgElement, filename) {
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    // 获取 SVG 实际尺寸（优先从 viewBox，其次 width/height 属性）
    let width = 800;
    let height = 600;
    const viewBox = svgElement.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.split(' ').map(Number);
      if (parts.length >= 4) {
        width = parts[2];
        height = parts[3];
      }
    } else {
      const w = parseFloat(svgElement.getAttribute('width'));
      const h = parseFloat(svgElement.getAttribute('height'));
      if (w) width = w;
      if (h) height = h;
    }

    // 使用 devicePixelRatio 提高清晰度
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.max(dpr, 2); // 至少 2 倍清晰度

    img.onload = () => {
      canvas.width = width * scale;
      canvas.height = height * scale;
      // 设置 Canvas CSS 尺寸
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.scale(scale, scale);
      // 填充白色背景（避免暗色主题下背景透明或变黑）
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = filename || 'diagram.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    img.onerror = (err) => {
      console.error('PNG conversion failed:', err);
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }

  /**
   * 将 HTML 表格转换为 Excel XML 字符串（兼容旧版 Excel）
   * @param {HTMLTableElement} table - 表格 DOM 元素
   * @returns {string} - Excel XML 格式的字符串
   */
  function tableToExcelXML(table) {
    const rows = table.querySelectorAll('tr');
    let xml = '<?xml version="1.0"?>\n';
    xml += '<?mso-application progid="Excel.Sheet"?>\n';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ';
    xml += 'xmlns:o="urn:schemas-microsoft-com:office:office" ';
    xml += 'xmlns:x="urn:schemas-microsoft-com:office:excel" ';
    xml += 'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
    xml += '  <Worksheet ss:Name="Sheet1">\n';
    xml += '    <Table>\n';

    rows.forEach(row => {
      xml += '      <Row>\n';
      const cells = row.querySelectorAll('th, td');
      cells.forEach(cell => {
        const text = cell.textContent.trim();
        // 判断是否为数字
        const num = Number(text);
        const type = !isNaN(num) && text !== '' ? 'Number' : 'String';
        xml += `        <Cell><Data ss:Type="${type}">${text}</Data></Cell>\n`;
      });
      xml += '      </Row>\n';
    });

    xml += '    </Table>\n';
    xml += '  </Worksheet>\n';
    xml += '</Workbook>';
    return xml;
  }

  // ==========================================
  // 3.5 新增功能辅助函数
  // ==========================================

  /**
   * HTML 转义函数
   * @param {string} unsafe - 原始字符串
   * @returns {string} 转义后的字符串
   */
  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * 为代码块应用语法高亮（使用 highlight.js）
   * @param {HTMLElement} container - 包含代码块的容器
   */
  function applyHighlighting(container) {
    if (!CONFIG.enableHighlight) return;
    const codeBlocks = container.querySelectorAll('pre code');
    codeBlocks.forEach(block => {
      // 避免重复高亮
      if (block.classList.contains('hljs')) return;

      const langMatch = block.className.match(/language-(\w+)/);
      const lang = langMatch ? langMatch[1] : '';

      if (lang && hljs.getLanguage(lang)) {
        // 指定语言高亮
        try {
          const result = hljs.highlight(block.textContent, { language: lang });
          block.innerHTML = result.value;
          block.classList.add('hljs');
        } catch (e) {
          console.warn('Highlight.js error:', e);
        }
      } else {
        // 自动检测语言高亮
        try {
          const result = hljs.highlightAuto(block.textContent);
          block.innerHTML = result.value;
          block.classList.add('hljs');
        } catch (e) {
          console.warn('Highlight.js auto error:', e);
        }
      }
    });
  }

  /**
   * 初始化图片 Lightbox 放大查看功能
   * @param {HTMLElement} container - 包含图片的容器
   */
  function initImageLightbox(container) {
    let lightbox = document.getElementById('md-lightbox-overlay');
    if (!lightbox) {
      lightbox = document.createElement('div');
      lightbox.id = 'md-lightbox-overlay';
      lightbox.className = 'md-lightbox-overlay';
      lightbox.innerHTML = '<img src="" alt="">';
      document.body.appendChild(lightbox);
      lightbox.addEventListener('click', () => {
        lightbox.classList.remove('active');
      });
    }
    const lightboxImg = lightbox.querySelector('img');
    const images = container.querySelectorAll('img');
    images.forEach(img => {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        lightboxImg.src = img.src;
        lightbox.classList.add('active');
      });
    });
  }

  /**
   * 初始化搜索功能
   */
  function initSearchBox() {
    let searchOverlay = document.getElementById('md-search-overlay');
    if (!searchOverlay) {
      searchOverlay = document.createElement('div');
      searchOverlay.id = 'md-search-overlay';
      searchOverlay.className = 'md-search-overlay';
      searchOverlay.innerHTML = '<div class="md-search-box"><div class="md-search-input-wrapper"><input type="text" class="md-search-input" placeholder="搜索文档内容..." autocomplete="off"></div><div class="md-search-results"></div></div>';
      document.body.appendChild(searchOverlay);
      const input = searchOverlay.querySelector('.md-search-input');
      const resultsContainer = searchOverlay.querySelector('.md-search-results');
      searchOverlay.addEventListener('click', (e) => {
        if (e.target === searchOverlay) {
          searchOverlay.classList.remove('active');
        }
      });
      searchOverlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          searchOverlay.classList.remove('active');
        }
      });
      let searchTimer = null;
      input.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          performSearch(input.value, resultsContainer);
        }, 300);
      });
    }
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchOverlay.classList.add('active');
        setTimeout(() => {
          searchOverlay.querySelector('.md-search-input').focus();
        }, 50);
      }
    });
  }

  /**
   * 执行搜索
   * @param {string} query - 搜索关键词
   * @param {HTMLElement} resultsContainer - 结果容器
   */
  function performSearch(query, resultsContainer) {
    if (!query || query.length < 2) {
      resultsContainer.innerHTML = '';
      return;
    }
    const previewContainer = document.getElementById('md-preview-container');
    if (!previewContainer) return;
    previewContainer.querySelectorAll('.md-search-highlight').forEach(el => {
      const parent = el.parentNode;
      parent.insertBefore(document.createTextNode(el.textContent), el);
      parent.removeChild(el);
    });
    const text = previewContainer.innerText;
    const regex = new RegExp(escapeRegExp(query), 'gi');
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      const before = text.substring(Math.max(0, match.index - 30), match.index);
      const after = text.substring(match.index + query.length, Math.min(text.length, match.index + query.length + 30));
      matches.push({ before: before, match: match[0], after: after });
    }
    if (matches.length === 0) {
      resultsContainer.innerHTML = '<div style="padding: 16px; color: var(--text-color);">未找到匹配结果</div>';
      return;
    }
    const walker = document.createTreeWalker(previewContainer, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode()) !== null) {
      if (node.parentElement && !node.parentElement.closest('.md-code-block, .md-mermaid-block')) {
        textNodes.push(node);
      }
    }
    let searchIndex = 0;
    textNodes.forEach(node => {
      const nodeText = node.textContent;
      if (regex.test(nodeText)) {
        regex.lastIndex = 0;
        const span = document.createElement('span');
        span.innerHTML = nodeText.replace(regex, () => {
          const index = searchIndex++;
          return `<mark class="md-search-highlight" data-search-index="${index}">$&</mark>`;
        });
        const parent = node.parentNode;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = span.innerHTML;
        const fragment = document.createDocumentFragment();
        while (tempDiv.firstChild) {
          fragment.appendChild(tempDiv.firstChild);
        }
        parent.replaceChild(fragment, node);
      }
    });
    let html = '';
    matches.slice(0, 20).forEach((m, index) => {
      html += '<div class="md-search-result-item" data-search-index="' + index + '">' + escapeHtml(m.before) + '<span class="highlight">' + escapeHtml(m.match) + '</span>' + escapeHtml(m.after) + '</div>';
    });
    if (matches.length > 20) {
      html += '<div style="padding: 10px 16px; color: var(--text-color);">还有 ' + (matches.length - 20) + ' 个结果...</div>';
    }
    resultsContainer.innerHTML = html;
    resultsContainer.querySelectorAll('.md-search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = item.getAttribute('data-search-index');
        const highlight = previewContainer.querySelector('.md-search-highlight[data-search-index="' + index + '"]');
        if (highlight) {
          highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        searchOverlay.classList.remove('active');
      });
    });
  }

  /**
   * 转义正则表达式特殊字符
   * @param {string} string - 原始字符串
   * @returns {string} 转义后的字符串
   */
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 更新字数统计
   * @param {string} text - Markdown 原始文本
   */
  function updateWordCount(text) {
    const countEl = document.getElementById('md-word-count');
    const timeEl = document.getElementById('md-reading-time');
    if (!countEl || !timeEl) return;

    // 去除 Markdown 标记后统计
    const plainText = text
      .replace(/#{1,6}\s/g, '')           // 去除标题标记
      .replace(/\*\*|__|\*|_|~~|`/g, '')  // 去除粗体、斜体、删除线、行内代码
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // 提取链接文本
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')      // 去除图片
      .replace(/```[\s\S]*?```/g, '')            // 去除代码块
      .replace(/`[^`]+`/g, '')                    // 去除行内代码
      .replace(/[\r\n\s]+/g, '');                // 去除空白

    // 中文字符数
    const chineseChars = (plainText.match(/[\u4e00-\u9fa5]/g) || []).length;
    // 英文单词数（近似）
    const englishWords = (plainText.match(/[a-zA-Z]+/g) || []).length;
    // 总字数（中文字符 + 英文单词）
    const totalWords = chineseChars + englishWords;

    // 阅读时间估算（中文约 400 字/分钟，英文约 200 词/分钟）
    const readingTime = Math.max(1, Math.ceil(totalWords / 400));

    countEl.textContent = totalWords.toLocaleString();
    timeEl.textContent = readingTime;
  }

  /**
   * 初始化回到顶部按钮
   */
  function initScrollTopButton() {
    let btn = document.getElementById('md-scroll-top-btn');
    const contentArea = document.getElementById('md-content-area');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'md-scroll-top-btn';
      btn.className = 'md-scroll-top-btn';
      btn.innerHTML = '↑';
      btn.title = '回到顶部';
      document.body.appendChild(btn);
      btn.addEventListener('click', () => {
        if (contentArea) {
          contentArea.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }
    const scrollTarget = contentArea || window;
    scrollTarget.addEventListener('scroll', () => {
      const scrollTop = contentArea ? contentArea.scrollTop : window.pageYOffset;
      if (scrollTop > 300) {
        btn.classList.add('visible');
      } else {
        btn.classList.remove('visible');
      }
    });
  }

  // ==========================================
  // 4. 事件绑定与交互逻辑
  // ==================================================

  function bindEvents(previewContainer, editorContainer, initialRawText) {
    let isPreviewMode = true; // 当前是否为预览模式
    let isEditMode = false;   // 当前是否为编辑模式

    const toggleBtn = document.getElementById('md-toggle-btn');
    const editBtn = document.getElementById('md-edit-btn');
    const resetBtn = document.getElementById('md-reset-btn');
    const themeBtn = document.getElementById('md-theme-btn');
    const tocSidebar = document.getElementById('md-viewer-toc');

    // --- 更多菜单逻辑 ---
    const moreBtn = document.getElementById('md-more-btn');
    const moreMenu = document.getElementById('md-more-menu');
    if (moreBtn && moreMenu) {
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = moreBtn.getBoundingClientRect();
        moreMenu.style.top = (rect.bottom + 6) + 'px';
        moreMenu.style.left = rect.left + 'px';
        moreMenu.classList.toggle('active');
      });
      document.addEventListener('click', (e) => {
        if (!moreMenu.contains(e.target) && !moreBtn.contains(e.target)) {
          moreMenu.classList.remove('active');
        }
      });
      moreMenu.querySelectorAll('.md-more-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = item.getAttribute('data-action');
          if (action === 'screenshot-auto') {
            takeScreenshot();
            moreMenu.classList.remove('active');
          } else if (action === 'screenshot-manual') {
            takeManualScreenshot();
            moreMenu.classList.remove('active');
          } else if (action === 'search') {
            const searchOverlay = document.getElementById('md-search-overlay');
            if (searchOverlay) {
              searchOverlay.classList.add('active');
              setTimeout(() => searchOverlay.querySelector('.md-search-input').focus(), 50);
            }
            moreMenu.classList.remove('active');
          } else if (action === 'shortcuts') {
            showShortcutsDialog();
            moreMenu.classList.remove('active');
          } else if (action === 'recent') {
            // 二级菜单由 hover 触发，点击不关闭菜单
          }
        });
      });
      // 最近文件二级菜单渲染（防止重复绑定）
      if (!moreMenu.dataset.recentInitialized) {
        const recentTrigger = moreMenu.querySelector('.md-more-submenu-trigger[data-action="recent"]');
        if (recentTrigger) {
          const recentSubmenu = recentTrigger.querySelector('#md-recent-submenu');
          if (recentSubmenu) {
            let hideTimer = null;

            function showSubmenu() {
              clearTimeout(hideTimer);
              renderRecentFiles(recentSubmenu);
              const triggerRect = recentTrigger.getBoundingClientRect();
              recentSubmenu.style.top = triggerRect.top + 'px';
              recentSubmenu.style.left = (triggerRect.right + 12) + 'px';
              recentSubmenu.style.display = 'block';
            }

            function hideSubmenu() {
              hideTimer = setTimeout(() => {
                recentSubmenu.style.display = 'none';
              }, 200);
            }

            // 一级菜单 hover
            recentTrigger.addEventListener('mouseenter', showSubmenu);
            recentTrigger.addEventListener('mouseleave', hideSubmenu);

            // 二级菜单 hover（取消隐藏）
            recentSubmenu.addEventListener('mouseenter', () => {
              clearTimeout(hideTimer);
            });
            recentSubmenu.addEventListener('mouseleave', () => {
              recentSubmenu.style.display = 'none';
            });
          }
        }
        moreMenu.dataset.recentInitialized = 'true';
      }
    }

    // --- 主题切换逻辑 ---
    if (themeBtn) {
      // 检查本地存储的主题偏好
      const savedTheme = localStorage.getItem('md-viewer-theme');
      if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeBtn.textContent = '☀️ 亮色';
      }

      themeBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme === 'dark') {
          document.documentElement.removeAttribute('data-theme');
          themeBtn.textContent = '🌙 暗色';
          localStorage.setItem('md-viewer-theme', 'light');
        } else {
          document.documentElement.setAttribute('data-theme', 'dark');
          themeBtn.textContent = '☀️ 亮色';
          localStorage.setItem('md-viewer-theme', 'dark');
        }
      });
    }

    // --- 全屏预览模式 ---
    const fullscreenBtn = document.getElementById('md-fullscreen-btn');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        const isFullscreen = document.body.classList.contains('md-fullscreen-mode');
        if (isFullscreen) {
          document.body.classList.remove('md-fullscreen-mode');
          fullscreenBtn.textContent = '⛶ 全屏';
        } else {
          document.body.classList.add('md-fullscreen-mode');
          fullscreenBtn.textContent = '⛶ 退出';
        }
      });
    }

    // --- 目录折叠/展开 ---
    if (tocSidebar) {
      const tocToggleBtn = tocSidebar.querySelector('.md-toc-toggle');
      if (tocToggleBtn) {
        // 恢复上次折叠状态
        const tocCollapsed = localStorage.getItem('md-viewer-toc-collapsed');
        if (tocCollapsed === 'true') {
          tocSidebar.classList.add('collapsed');
          tocToggleBtn.textContent = '▶';
        }

        tocToggleBtn.addEventListener('click', () => {
          const isCollapsed = tocSidebar.classList.contains('collapsed');
          if (isCollapsed) {
            tocSidebar.classList.remove('collapsed');
            tocToggleBtn.textContent = '◀';
            localStorage.setItem('md-viewer-toc-collapsed', 'false');
          } else {
            tocSidebar.classList.add('collapsed');
            tocToggleBtn.textContent = '▶';
            localStorage.setItem('md-viewer-toc-collapsed', 'true');
          }
        });
      }
    }

    // --- 切换 预览/源码 模式 ---
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (isEditMode) return; // 编辑模式下禁用此切换
        
        isPreviewMode = !isPreviewMode;
        previewContainer.style.display = isPreviewMode ? 'block' : 'none';
        editorContainer.style.display = isPreviewMode ? 'none' : 'block';
        
        toggleBtn.innerHTML = isPreviewMode ? '👁️ 预览' : '📝 源码';
        toggleBtn.classList.toggle('active', isPreviewMode);
        
        // 源码模式下暂时隐藏 TOC 以提供更宽的视野
        if (tocSidebar) tocSidebar.style.display = isPreviewMode ? 'block' : 'none';
      });
    }

    // --- 进入/退出 编辑模式 ---
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        isEditMode = !isEditMode;
        
        if (isEditMode) {
          // 进入编辑状态
          editorContainer.style.display = 'block';
          previewContainer.style.display = 'none';
          editorContainer.value = window.__mdRawContent; // 加载当前内容
          
          editBtn.innerHTML = '✅ 完成';
          editBtn.classList.add('active');
          
          if (resetBtn) resetBtn.style.display = 'inline-block';
          if (toggleBtn) toggleBtn.style.display = 'none';
          if (tocSidebar) tocSidebar.style.display = 'none';
        } else {
          // 退出编辑状态，同步最终结果
          window.__mdRawContent = editorContainer.value;
          parseMarkdown(editorContainer.value).then(html => {
            previewContainer.innerHTML = html;
            addCodeCopyButtons(previewContainer);
            addTableActions(previewContainer);
            // if (tocSidebar) tocSidebar.innerHTML = generateTOC(html);
            if (CONFIG.enableTOC && tocSidebar) {
              tocSidebar.innerHTML = processHeadersAndGenerateTOC(previewContainer);
            }
          });

          isPreviewMode = true;
          previewContainer.style.display = 'block';
          editorContainer.style.display = 'none';
          
          editBtn.innerHTML = '✏️ 编辑';
          editBtn.classList.remove('active');
          
          if (resetBtn) resetBtn.style.display = 'none';
          if (toggleBtn) toggleBtn.style.display = 'inline-block';
          if (tocSidebar) tocSidebar.style.display = 'block';
        }
      });
    }

    // --- 实时编辑监听 (带防抖) ---
    if (editorContainer) {
      editorContainer.addEventListener('input', () => {
        if (isEditMode) {
          window.__mdRawContent = editorContainer.value;
          
          // 防抖处理：停止输入 500ms 后再重新渲染，提升性能
          clearTimeout(window.__mdRenderTimer);
          window.__mdRenderTimer = setTimeout(() => {
            parseMarkdown(editorContainer.value).then(html => {
              previewContainer.innerHTML = html;
              addCodeCopyButtons(previewContainer);
              addTableActions(previewContainer);
              // if (tocSidebar) tocSidebar.innerHTML = generateTOC(html);
              // 实时更新目录
              if (CONFIG.enableTOC && tocSidebar) {
                tocSidebar.innerHTML = processHeadersAndGenerateTOC(previewContainer);
              }
            });
          }, 500);
        }
      });
    }

    // --- 重置功能 ---
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('确定要放弃所有修改并重置到原始内容吗？')) {
          editorContainer.value = originalContent;
          window.__mdRawContent = originalContent;
          // 立即触发一次渲染更新
          parseMarkdown(originalContent).then(html => {
            previewContainer.innerHTML = html;
            addCodeCopyButtons(previewContainer);
            addTableActions(previewContainer);
            // if (tocSidebar) tocSidebar.innerHTML = generateTOC(html);
            if (CONFIG.enableTOC && tocSidebar) {
              tocSidebar.innerHTML = processHeadersAndGenerateTOC(previewContainer);
            }
          });
        }
      });
    }


    // --- 【新增】处理内容区域内的锚点跳转 (解决右侧点击目录无反应的问题) ---
    // 使用事件委托，监听整个 previewContainer 内的点击
    previewContainer.addEventListener('click', (e) => {
      // 查找最近的 <a> 标签
      const link = e.target.closest('a');
      if (link) {
        const hash = link.getAttribute('href');
        // 如果链接是以 # 开头的内部锚点
        if (hash && hash.startsWith('#')) {
          e.preventDefault(); // 阻止默认跳转行为
          let targetEl = null;
          let rawTarget  = hash.substring(1); // 去掉 # 号
          console.log('rawTarget:', decodeURIComponent(hash));
          // 1. 优先尝试直接通过 ID 查找（适用于插件生成的目录链接 #heading-x）
          targetEl = document.getElementById(rawTarget);

          // 2. 如果没找到，尝试解码后查找（适用于 Marked 生成的中文链接 #功能特性）
          if (!targetEl) {
            try {
              const decodedTarget = decodeURIComponent(rawTarget);
              targetEl = document.getElementById(decodedTarget);
            } catch (err) {
              // 忽略解码错误
            }
          }
          // 3. 【核心修复】如果还是没找到，尝试通过“文本内容”匹配
          if (!targetEl) {
            const decodedText = decodeURIComponent(rawTarget).replace(/-/g, ' '); // 有些解析器会把空格变成 -
            
            // 遍历所有标题，看是否有文本匹配的
            const allHeaders = previewContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');
            for (let h of allHeaders) {
              if (h.textContent.trim() === decodedText || headingIdMap[decodedText]) {
                targetEl = h;
                break;
              }
            }
            
            // 如果映射表里有，直接用映射表的 ID
            if (!targetEl && headingIdMap[decodedText]) {
               targetEl = document.getElementById(headingIdMap[decodedText]);
            }
          }
          console.log('Target element:', targetEl);
          if (targetEl) {
            // 执行平滑滚动，并减去工具栏的高度 (约 60px)
            const contentArea = document.getElementById('md-content-area');
            const offsetTop = targetEl.offsetTop - 70;
            if (contentArea) {
              contentArea.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
              });
            } else {
              window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
              });
            }

            // 【新增】同步更新左侧目录的选中状态
            const tocSidebar = document.getElementById('md-viewer-toc');
            if (tocSidebar) {
              const allLinks = tocSidebar.querySelectorAll('.toc-link');
              allLinks.forEach(l => l.classList.remove('active'));
              // 找到对应的目录链接并高亮
              const targetId = targetEl.id;
              const activeLink = tocSidebar.querySelector(`.toc-link[data-target="${targetId}"]`);
              if (activeLink) {
                activeLink.classList.add('active');
                // 可选：将选中的目录项滚动到可视区域
                activeLink.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }
            
          }else{
            console.warn(`Target element not found for ID: ${targetId}`);
          }
        }
      }
    });

    
    // --- 复制功能 ---
    const copyBtn = document.getElementById('md-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(window.__mdRawContent || '').then(() => {
          alert('✅ Markdown 源码已复制到剪贴板');
        }).catch(err => {
          console.error('Copy failed:', err);
        });
      });
    }

    // --- 代码块复制功能 ---
    previewContainer.addEventListener('click', (e) => {
      const copyCodeBtn = e.target.closest('.md-copy-code-btn');
      if (copyCodeBtn) {
        e.preventDefault();
        const wrapper = copyCodeBtn.closest('.md-code-block');
        const codeBlock = wrapper ? wrapper.querySelector('pre code') : null;
        const codeText = codeBlock ? codeBlock.textContent : '';
        navigator.clipboard.writeText(codeText).then(() => {
          const originalText = copyCodeBtn.textContent;
          copyCodeBtn.textContent = '已复制';
          copyCodeBtn.classList.add('copied');
          setTimeout(() => {
            copyCodeBtn.textContent = originalText;
            copyCodeBtn.classList.remove('copied');
          }, 2000);
        }).catch(err => {
          console.error('Code copy failed:', err);
        });
      }

      // --- 代码块复制 MD 格式功能 ---
      const copyMdBtn = e.target.closest('.md-copy-md-btn');
      if (copyMdBtn) {
        e.preventDefault();
        const wrapper = copyMdBtn.closest('.md-code-block');
        const codeBlock = wrapper ? wrapper.querySelector('pre code') : null;
        const codeText = codeBlock ? codeBlock.textContent : '';
        // 提取语言标识，例如 "language-javascript" -> "javascript"
        let lang = '';
        if (codeBlock) {
          const langMatch = codeBlock.className.match(/language-(\w+)/);
          if (langMatch) {
            lang = langMatch[1];
          }
        }
        const mdText = '\`\`\`' + lang + '\n' + codeText + '\n\`\`\`';
        navigator.clipboard.writeText(mdText).then(() => {
          const originalText = copyMdBtn.textContent;
          copyMdBtn.textContent = '已复制';
          copyMdBtn.classList.add('copied');
          setTimeout(() => {
            copyMdBtn.textContent = originalText;
            copyMdBtn.classList.remove('copied');
          }, 2000);
        }).catch(err => {
          console.error('MD copy failed:', err);
        });
      }

      // --- 代码块源码/渲染切换功能 ---
      const toggleBtn = e.target.closest('.md-code-toggle');
      if (toggleBtn) {
        e.preventDefault();
        const wrapper = toggleBtn.closest('.md-code-block');
        if (!wrapper) return;
        const pre = wrapper.querySelector('pre');
        const sourceArea = wrapper.querySelector('.md-code-source');
        if (pre && sourceArea) {
          if (pre.style.display === 'none') {
            // 当前是源码模式，切换到渲染模式
            pre.style.display = 'block';
            sourceArea.style.display = 'none';
            toggleBtn.textContent = '源码';
          } else {
            // 当前是渲染模式，切换到源码模式
            pre.style.display = 'none';
            sourceArea.style.display = 'block';
            toggleBtn.textContent = '渲染';
          }
        }
      }

      // --- 代码块折叠/展开功能 ---
      const foldBtn = e.target.closest('.md-code-fold-btn');
      if (foldBtn) {
        e.preventDefault();
        const wrapper = foldBtn.closest('.md-code-block');
        if (!wrapper) return;
        const pre = wrapper.querySelector('pre');
        const overlay = wrapper.querySelector('.md-code-fold-overlay');
        if (pre) {
          const isFolded = pre.style.maxHeight === '300px';
          if (isFolded) {
            // 展开
            pre.style.maxHeight = 'none';
            pre.style.overflow = 'visible';
            foldBtn.textContent = '收起';
            if (overlay) overlay.style.display = 'none';
          } else {
            // 收起
            pre.style.maxHeight = '300px';
            pre.style.overflow = 'hidden';
            foldBtn.textContent = '展开';
            if (overlay) overlay.style.display = 'block';
          }
        }
      }
    });

    // --- 表格下载 CSV 功能 ---
    previewContainer.addEventListener('click', (e) => {
      const downloadCsvBtn = e.target.closest('.md-download-csv-btn');
      if (downloadCsvBtn) {
        e.preventDefault();
        const wrapper = downloadCsvBtn.closest('.md-table-block');
        const table = wrapper ? wrapper.querySelector('table') : null;
        if (table) {
          const csvText = tableToCSV(table);
          const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'table.csv';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }
    });

    // --- 表格下载 Excel 功能 ---
    previewContainer.addEventListener('click', (e) => {
      const downloadExcelBtn = e.target.closest('.md-download-excel-btn');
      if (downloadExcelBtn) {
        e.preventDefault();
        const wrapper = downloadExcelBtn.closest('.md-table-block');
        const table = wrapper ? wrapper.querySelector('table') : null;
        if (table) {
          const excelText = tableToExcelXML(table);
          const blob = new Blob([excelText], { type: 'application/vnd.ms-excel' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'table.xls';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }
    });

    // --- 表格源码/渲染切换功能 ---
    previewContainer.addEventListener('click', (e) => {
      const tableToggleBtn = e.target.closest('.md-table-toggle');
      if (tableToggleBtn) {
        e.preventDefault();
        const wrapper = tableToggleBtn.closest('.md-table-block');
        if (!wrapper) return;
        const table = wrapper.querySelector('table');
        const sourceArea = wrapper.querySelector('.md-table-source');
        if (table && sourceArea) {
          if (table.style.display === 'none') {
            // 当前是源码模式，切换到渲染模式
            table.style.display = '';
            sourceArea.style.display = 'none';
            tableToggleBtn.textContent = '源码';
          } else {
            // 当前是渲染模式，切换到源码模式
            table.style.display = 'none';
            sourceArea.style.display = 'block';
            tableToggleBtn.textContent = '渲染';
          }
        }
      }
    });

    // --- 表格复制功能 ---
    previewContainer.addEventListener('click', (e) => {
      const copyTableBtn = e.target.closest('.md-copy-table-btn');
      if (copyTableBtn) {
        e.preventDefault();
        const wrapper = copyTableBtn.closest('.md-table-block');
        const mdSource = wrapper ? wrapper.getAttribute('data-md-source') : '';
        if (mdSource) {
          navigator.clipboard.writeText(mdSource).then(() => {
            const originalText = copyTableBtn.textContent;
            copyTableBtn.textContent = '已复制';
            copyTableBtn.classList.add('copied');
            setTimeout(() => {
              copyTableBtn.textContent = originalText;
              copyTableBtn.classList.remove('copied');
            }, 2000);
          }).catch(err => {
            console.error('Table copy failed:', err);
          });
        }
      }
    });

    // --- Mermaid 图表操作 ---
    // 源码/渲染切换
    previewContainer.addEventListener('click', (e) => {
      const mermaidToggleBtn = e.target.closest('.md-mermaid-toggle');
      if (mermaidToggleBtn) {
        e.preventDefault();
        const wrapper = mermaidToggleBtn.closest('.md-mermaid-block');
        if (!wrapper) return;
        const diagram = wrapper.querySelector('.mermaid-diagram');
        const sourceArea = wrapper.querySelector('.md-mermaid-source');
        if (diagram && sourceArea) {
          if (diagram.style.display === 'none') {
            diagram.style.display = 'block';
            sourceArea.style.display = 'none';
            mermaidToggleBtn.textContent = '源码';
          } else {
            diagram.style.display = 'none';
            sourceArea.style.display = 'block';
            mermaidToggleBtn.textContent = '渲染';
          }
        }
      }
    });

    // 复制 MD 功能
    previewContainer.addEventListener('click', (e) => {
      const copyMermaidBtn = e.target.closest('.md-copy-mermaid-btn');
      if (copyMermaidBtn) {
        e.preventDefault();
        const wrapper = copyMermaidBtn.closest('.md-mermaid-block');
        const sourceArea = wrapper ? wrapper.querySelector('.md-mermaid-source') : null;
        const mdSource = sourceArea ? sourceArea.value : '';
        if (mdSource) {
          navigator.clipboard.writeText(mdSource).then(() => {
            const originalText = copyMermaidBtn.textContent;
            copyMermaidBtn.textContent = '已复制';
            copyMermaidBtn.classList.add('copied');
            setTimeout(() => {
              copyMermaidBtn.textContent = originalText;
              copyMermaidBtn.classList.remove('copied');
            }, 2000);
          }).catch(err => {
            console.error('Mermaid copy failed:', err);
          });
        }
      }
    });

    // 下载下拉菜单交互
    previewContainer.addEventListener('click', (e) => {
      const downloadTrigger = e.target.closest('.md-mermaid-download-trigger');
      if (downloadTrigger) {
        e.preventDefault();
        const menu = downloadTrigger.nextElementSibling;
        if (menu) {
          menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
        }
        return;
      }

      const downloadItem = e.target.closest('.md-mermaid-download-item');
      if (downloadItem) {
        e.preventDefault();
        const format = downloadItem.getAttribute('data-format');
        const wrapper = downloadItem.closest('.md-mermaid-block');
        const svgElement = wrapper ? wrapper.querySelector('.mermaid-diagram svg') : null;
        if (svgElement) {
          if (format === 'png') {
            downloadPNG(svgElement, 'mermaid-diagram.png');
          } else if (format === 'svg') {
            downloadSVG(svgElement, 'mermaid-diagram.svg');
          }
        }
        // 关闭下拉菜单
        const menu = downloadItem.closest('.md-mermaid-download-menu');
        if (menu) menu.style.display = 'none';
      }
    });

    // 点击页面其他地方关闭下载下拉菜单
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.md-mermaid-download')) {
        const menus = document.querySelectorAll('.md-mermaid-download-menu');
        menus.forEach(menu => menu.style.display = 'none');
      }
    });

    // --- 下载功能 ---
    const downloadBtn = document.getElementById('md-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const blob = new Blob([window.__mdRawContent || ''], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = window.__mdFileName || 'document.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

    // --- 【新增】滚动时同步更新目录高亮 ---
    // 监听右侧内容区域滚动，自动高亮当前可见的章节
    if (CONFIG.enableTOC) {
      let ticking = false;
      const contentArea = document.getElementById('md-content-area');
      const updateActiveTOCOnScroll = () => {
        // 如果正在点击目录，跳过滚动监听，避免与点击选中状态冲突导致闪烁
        if (window.__isClickingTOC) return;
        if (!ticking) {
          window.requestAnimationFrame(() => {
            const headers = previewContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');
            if (headers.length === 0) return;
            
            // 找到当前在视口中最靠近顶部（且在上方）的标题
            let activeHeader = null;
            const scrollTop = contentArea ? contentArea.scrollTop : (window.pageYOffset || document.documentElement.scrollTop);
            const offset = 80; // 工具栏高度偏移量
            
            for (let i = headers.length - 1; i >= 0; i--) {
              const header = headers[i];
              const headerOffsetTop = contentArea ? header.offsetTop : (header.getBoundingClientRect().top + window.pageYOffset);
              const headerTop = headerOffsetTop - offset;
              if (headerTop <= scrollTop + offset) {
                activeHeader = header;
                break;
              }
            }
            
            // 如果没有找到（表示在页面顶部），选中第一个标题
            if (!activeHeader && headers.length > 0) {
              activeHeader = headers[0];
            }
            
            if (activeHeader) {
              const tocSidebar = document.getElementById('md-viewer-toc');
              if (tocSidebar) {
                const allLinks = tocSidebar.querySelectorAll('.toc-link');
                allLinks.forEach(l => l.classList.remove('active'));
                const activeLink = tocSidebar.querySelector(`.toc-link[data-target="${activeHeader.id}"]`);
                if (activeLink) {
                  activeLink.classList.add('active');
                  // 只有当目录项不在可视区域内时才滚动，避免高频触发导致闪烁
                  const sidebarRect = tocSidebar.getBoundingClientRect();
                  const linkRect = activeLink.getBoundingClientRect();
                  if (linkRect.top < sidebarRect.top || linkRect.bottom > sidebarRect.bottom) {
                    // 使用 scrollTop 手动滚动，避免 scrollIntoView 触发 window scroll 事件导致循环
                    tocSidebar.scrollTop = activeLink.offsetTop - 20;
                    // scrollIntoView 方法有问题导致拖动滚动结束还会自动滚动，避免 scrollIntoView 触发 window scroll 事件导致循环
                    //activeLink.scrollIntoView({ block: 'nearest' });
                  }
                }
              }
            }
            ticking = false;
          });
          ticking = true;
        }
      };
      
      const scrollTarget = contentArea || window;
      scrollTarget.addEventListener('scroll', updateActiveTOCOnScroll);
    }

    // --- 阅读进度条 ---
    const progressBar = document.getElementById('md-reading-progress-bar');
    if (progressBar) {
      const contentArea = document.getElementById('md-content-area');
      const updateProgress = () => {
        const scrollTarget = contentArea || window;
        const scrollTop = contentArea ? contentArea.scrollTop : (window.scrollY || document.documentElement.scrollTop || 0);
        const scrollHeight = contentArea ? contentArea.scrollHeight : Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        const clientHeight = contentArea ? contentArea.clientHeight : window.innerHeight;
        const scrollableHeight = scrollHeight - clientHeight;
        const progress = scrollableHeight > 0 ? (scrollTop / scrollableHeight) * 100 : 0;
        progressBar.style.width = Math.min(100, Math.max(0, progress)) + '%';
      };
      const scrollTarget = contentArea || window;
      scrollTarget.addEventListener('scroll', updateProgress);
      // 初始更新（延迟执行，确保内容渲染完成）
      setTimeout(updateProgress, 100);
    }
  }

  // ==========================================
  // 5. 启动入口
  // ==========================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderMarkdown);
  } else {
    renderMarkdown();
  }

  // 暴露到 window，供开发模式重新触发
  window.__mdRenderMarkdown = renderMarkdown;
})();