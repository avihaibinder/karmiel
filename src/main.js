// Boot + main loop.
import { THREE, $, renderer, scene, camera, pick, clamp, sleep, label } from './core.js';
import * as W from './world.js';
import { LM, FLAGS } from './landmarks.js';
import { updateSky, sun } from './sky.js';
import { P, updatePlayer, syncPlayer, updateCamera, cam, pressed, mount, dismount, nearScooter, scooter, knock, teleport } from './player.js';
import { updateTraffic, traffic } from './traffic.js';
import { npcs, npc, updateNPCs, nearestNPC, addNPC, bark, placeNPC, hideNPC } from './npc.js';
import { UI, PLAYER, say, ask, advance, closeDialog, tickDialog, tickTimer, drawRadar, radarNoSignal, drawBigMap, setLocation, prompt, toast, achieve, wa, showHUD, fade, pa, setBlip, removeBlip } from './ui.js';
import { ac, sfx, music, setMuted, audio } from './audio.js';
import { mg } from './minigames.js';
import { TOUCH } from './touch.js';
import { tickTreasures, resetTreasures } from './treasures.js';
import { tickPizza } from './pizza.js';
if (TOUCH) renderer.setPixelRatio(1);   // phones: keep the frame rate up
import { CONVOS, HATIM, PLAYER_REACT } from './banter.js';
const HATIM_LINES = HATIM.lines;
import { updateHorror, horror, nearNest } from './horror.js';
import { G, M, tickWaiters, tickItems, tickCat, tickBakery, tickBlocks, newGame, continueGame, loadSave, refreshBlips, cutscene, openRoundabout, mitziRun, setName } from './missions.js';

// =====================================================================
// residents (30 wanderers with the design's one-liners)
// =====================================================================
const RES_LINES = ['כרמיאל זה 20 דקות מהכל. מהים, מהכנרת, מחיפה. מתל אביב לא. אבל מי צריך.', 'אתה יוסי? של הפייסבוק? אל תעזוב, יש לי בת.', 'פה יש שקט. בתל אביב יש "אווירה". אווירה זה שקט שעולה 48 שקל.', 'היית בכיכר החדשה? לא? איזו מהן? נכון.', 'הבן שלי בתל אביב. הוא מתקשר כל שבוע לשאול אם יש פה עבודה.', 'אני גר פה 40 שנה. עוד לא עברתי את כל הכיכרות. יש לי תוכנית לפנסיה.', 'תגיד לסבתא שלך שהקציצות שלה עדיין אצלי בפריזר. מ-2017. אני שומר לאירוע.', 'בפסטיבל של 99\' רקדתי עם מישהו מבולגריה. לא הבנתי מילה. היה מושלם.', 'סליחה, זה הקו לחיפה? לא? אז למה אני פה מאז הבוקר?', 'אני לא בפייסבוק. אני שומע מבוריס. זה יותר מהיר.', 'אמרו שבתל אביב אין חניה. חשבתי שזה מטאפורה.', 'תדע לך שבקניון הישן היה פעם באולינג. אני הייתי אלוף. אני עדיין אלוף. אין עם מי לשחק.', 'הר כמון? ביום בהיר רואים ממנו את החרמון. ביום לא בהיר רואים את הר כמון.', 'אתה עם קורקינט? בכיכרות? אתה יותר אמיץ מהצבא.', 'ראש העיר חנך אתמול כיכר. היום אני לא מוצא את הבית.', 'יש לי חדר פנוי אם אתה רוצה להישאר. 1,800. עם מרפסת. וחתול. לא מיצי. חתול אחר. מפחיד יותר.', 'תל אביב זה כמו כרמיאל, רק שכולם מחכים לאוטובוס ואף אחד לא מכיר אותך.', 'הנכדה שלי גרה בפלורנטין. היא אומרת שזה "אותנטי". אני לא הבנתי מה זה, אבל זה עולה כסף.', 'אתה מכיר את מוטי? מהפלאפל? זה גבר. זה עמוד. זה פלאפל.', 'בשניצליה יש בגט שיכול להחזיק משפחה. אני יודע. החזקתי איתו שתיים.', 'אני לא מפחד מכביש 85. כביש 85 מפחד ממני.', 'יוסי! אני המורה שלך מכיתה ד\'! לא? אז לא. אבל תאכל משהו, אתה חיוור.', 'מה זה "רילוקיישן"? זה כשעוברים דירה ברחוב ממול?', 'בגן היפני יש שקט כזה שאפשר לשמוע את הפייסבוק של השכנים.', 'אני בתור בעירייה. מספר 12. זה ראש העיר שם לפניי? כן. חיכינו ביחד. היה נחמד.', 'הבן שלי אומר שבתל אביב יש "סצנה". פה יש סצנה בכל פעם שמישהו חונה על הדשא.', 'יש לך את זה? את הלוק של מי שעוזב? ככה נראה גם הדוד שלי ב-94\'. הוא חזר ב-96\'.', 'סליחה, ראית חתולה ג\'ינג\'ית עם חותמת? לא, סתם. רציתי להרגיש חלק.', 'אתה יודע כמה זמן לוקח לי לתל אביב? שעה ו-45. ובחזרה? 20 דקות. לא יודע איך. זה קסם.', 'ביג? יש לי שם אוטו. מתישהו. באיזשהו מקום. אורנה ואני בקבוצת תמיכה.', 'תשמע, אני נהג 30 שנה. אף פעם לא יצאתי מכיכר בפעם הראשונה. זה עניין של כבוד.', 'אם תעבור לתל אביב, תשלח תמונה. של הקפה. אני רוצה לראות מה זה 48 שקל.', 'גבעת מכוש בשקיעה. זה כל מה שאני אגיד. לך תראה. אחרי זה תחליט.', 'היית באורט בראודה? אני יודע כי יש לך את המבט. מבט של מי שלמד תרמודינמיקה ביום שישי.',
  'ראיתי אתמול כיכר חדשה. ניגשתי. היא לא הייתה שם. ראש העיר חנך אותה ואז התחרט. יש לו ימים כאלה.', 'אתה עוזב? יופי. קח לי מכתב לבן שלי בתל אביב. אין לו כתובת. תצעק את השם שלו בכיכר דיזנגוף. הוא יענה. הוא תמיד עונה.', 'יש לי תאוריה: כרמיאל היא לא עיר. היא כיכר אחת ענקית, ואנחנו כולנו באמצע. העירייה זה העציץ.', 'הנכדה אמרה שבתל אביב יש ״קהילה״. שאלתי אם מביאים מרק כשחולים. היא אמרה שיש אפליקציה. בכיתי לתוך הסיר.', 'אתה הבחור מהפייסבוק? תעשה לי טובה, תעזוב כבר. יש לי הימור עם אבנר. שמתי על ״ביום רביעי״. הוא שם את הכלב.', 'ב-1994 יצאתי מכרמיאל לשבוע. חזרתי אחרי יומיים. לא היה לי עם מי לריב על חניה. הרגשתי לא נראה.', 'בוריס אמר שבתל אביב קפה 48 שקל. בדקתי. הוא צדק. אני לא מספר לו. הוא יהיה בלתי נסבל. יותר.', 'הכלב שלי יודע לצאת מכיכר. בוריס לא. יש פה לקח על חינוך. או על בוריס.', 'אם אתה כבר עוזב, תיקח את החמוצים של רבקה? היא נותנת לי כל שבוע. המרתף מלא. אני ישן בסלון. החמוצים ישנים בחדר.', 'אני גר ליד האמפי. כל קיץ 4,000 איש רוקדים לי מתחת לחלון. אני לא מתלונן. אני רוקד. בפיג׳מה. לבד. גלית ראתה. היא נתנה הערות.', 'כרמיאל זה כמו ״הוטל קליפורניה״. בלי הוטל. עם 180 צ׳ק-אאוטים שכולם מחזירים ללובי.', 'הבן שלי בתל אביב שואל מה חדש. אמרתי ״כיכר״. הוא שאל ״ועוד?״. אמרתי ״עוד כיכר״. הוא ניתק. הוא יחזור. כולם חוזרים.', 'ראיתי את מיצי לוקחת למאיר את המשקפיים. הוא לא ראה. הוא עדיין לא רואה. הוא מריח את הדרך הביתה. הוא מגיע ראשון.', 'הייתי פעם בכנס בתל אביב. שאלו מאיפה אני. אמרתי ״20 דקות מהכל״. הם חשבו שזו שכונה. היא כן. היא שכונה בלב.',
  'התגרשתי בגלל כיכר. היא אמרה ״יציאה שנייה״. אני אמרתי ״שלישית״. יצאנו ברביעית. כל אחד לבד. הדס קראה לזה ״התקדמות״. חייבה את שנינו.', 'הבן שלי מתפרנס בתל אביב מ״תוכן״. שאלתי מה זה. הוא הראה לי. ראיתי את עצמי. בפיג׳מה. רבע מיליון צפיות. ״אותנטי״, כתבו. אני לא יודע מה זה, אבל זה אני.', 'סבתא שלך הביאה קציצות לשבעה של בעלי. היו כאלה טובות שרבנו מי יורש את הקופסה. בעלי לא השתתף בדיון. הוא היה מסכים. הוא תמיד הסכים. בגלל זה הוא מת.', 'תל אביב זה מקום שמשלמים בו 7,800 כדי לישון ליד הכביש ולקרוא לזה ״אנרגיה״. פה זה חינם. וקוראים לזה בוריס.', 'בשבת אני לא נוסע. אני עומד בכיכר ונותן לאחרים להסתובב. כמו אלוהים. הוא גם לא עוצר. הוא גם לא מאותת.', 'ראיתי את ראש העיר בוכה ליד כיכר. שאלתי מה קרה. ״היא יפה״, הוא אמר. אשתו עזבה באותו שבוע. על זה הוא לא בכה. על זה הוא חנך.', 'אתה הנכד של רבקה? אז אתה לא יודע שהיא מוכרת את הקציצות ״שלך״ לשכנים. 12 שקל קופסה. יש לה עסק. אתה המותג. אתה לא רואה שקל.', 'פה אין פקקים. יש כיכרות. זה כמו פקק, רק עם תחושה שאתה מתקדם. כמו הנישואים שלי. כמו קו 1. כמו הטיפול אצל הדס.', 'ב-93 ראיתי בקניון הישן בובה זזה. לא סיפרתי. התחתנתי. אשתי לא זזה כשאני מסתכל. 30 שנה. יש קשר. אני לא בודק.'];
const RES_NAMES = ['חנה', 'אלון', 'מזל', 'דוד', 'רינה', 'ששון', 'ליאת', 'אבי', 'סיגל', 'ולדימיר', 'נאוה', 'עמית', 'פנינה', 'יעקב', 'ענבל', 'רוני', 'ז\'אנה', 'סמיר', 'שירה', 'גבי', 'מלכה', 'איתי', 'לנה', 'שמעון', 'דנה', 'יוסף', 'אורית', 'רפי', 'טל', 'אסתר'];
const COLS = [0xe63946, 0x2a9d8f, 0xf4a261, 0x457b9d, 0xb388ff, 0xffd166, 0x6d597a, 0x8d99ae, 0x06d6a0, 0xef476f];
{
  // each resident first plays a short conversation (banter.js), then falls back to one-liners
  const hubs = ['cityhall', 'lev', 'schnitzelia', 'bus', 'familyPark', 'galilPark', 'big', 'braude', 'kikar', 'rabinPark', 'station', 'japanese'].map(k => W.POI[k]).filter(Boolean);
  const place = (h, r0 = 15, r1 = 65) => { let x, z, tries = 0; do { const a = Math.random() * 6.28, r = r0 + Math.random() * (r1 - r0); x = h.x + Math.cos(a) * r; z = h.z + Math.sin(a) * r; } while (!W.free(x, z) && ++tries < 40); return { x, z }; };
  const lookFor = kind => { const old = kind === 'old' || (kind === 'any' && Math.random() < 0.3); return { shirt: pick(COLS), pants: pick([0x34466e, 0x222222, 0x555555, 0x8a7f72]), hair: old ? 0xcccccc : pick([0x222222, 0x3b2a1e, 0x8b5a2b, 0xd4a373]), skin: pick([0xe6b98f, 0xd9a47a, 0xc68e5e, 0xf1c9a5]), ponytail: Math.random() < 0.35, glasses: old || Math.random() < 0.25, belly: Math.random() < 0.2, kippah: Math.random() < 0.08 ? 0x1d3557 : undefined, cap: Math.random() < 0.15 ? pick(COLS) : undefined }; };
  // recurring townies: one NPC per name, their conversations play in order (one per chat)
  const byWho = new Map(); for (const c of CONVOS) { if (!byWho.has(c.who)) byWho.set(c.who, []); byWho.get(c.who).push(c); }
  const people = [
    ...[...byWho].map(([who, cs]) => ({ name: who, kind: cs[0].look || 'any', convos: cs.sort((a, b) => (a.step || 0) - (b.step || 0)) })),
    ...RES_NAMES.filter(n => !byWho.has(n)).slice(0, Math.max(0, 36 - byWho.size)).map(n => ({ name: n, kind: 'any', convos: [] })),   // no second דוד / פנינה
  ];
  const talkedTo = new Set();
  people.forEach((p, i) => {
    const { x, z } = place(hubs[i % hubs.length]);
    const n = addNPC({ id: 'res' + i, name: p.name, x, z, look: lookFor(p.kind), wander: 14 });
    if (p.kind === 'kid') n.h.g.scale.setScalar(0.7);
    let li = Math.floor(Math.random() * RES_LINES.length), cnt = 0;
    n.talk = async () => {
      cnt++;
      talkedTo.add(p.name); if (talkedTo.size === 20) achieve('social', 'כולם מכירים את כולם', 'דיברת עם 20 תושבים. כולם כבר ידעו מי אתה. עכשיו גם אתה יודע מי הם. זה גרוע יותר.');
      if (cnt === 1 && PLAYER.name !== 'יוסי' && PLAYER_REACT?.rename?.length && Math.random() < 0.25) return say(p.name, pick(PLAYER_REACT.rename).replace(/\{name\}/g, PLAYER.name));
      const cv = p.convos.shift();
      if (cv) {
        for (const [s, t] of cv.lines) await say(s, t);
        if (cv.choice) { const c = cv.choice, k = await ask(p.name, c.q, c.opts); for (const t of [].concat(c.replies[k] || [])) await say(p.name, t); }
        return;
      }
      await say(p.name, cnt === 4 ? 'כבר דיברנו ארבע פעמים. אני אגיד לסבתא שלך שאתה בודד. היא תביא אוכל. לי.' : RES_LINES[li++ % RES_LINES.length]);
    };
  });
  // residents of "החתים" on Sha'ar HaGai St.
  const HAT_NAMES = ['רפי מהחת השני', 'שמוליק מהחת הרביעי', 'ז׳ורה מהקומה ה-9', 'ציון, ועד בית החתים'];   // HATIM lines are written in masculine
  HAT_NAMES.forEach((name, i) => {
    const h = W.CHETS[(i * 2) % W.CHETS.length]; if (!h) return;
    const { x, z } = place(h, 14, 30);
    const n = addNPC({ id: 'hat' + i, name, x, z, look: lookFor(i % 2 ? 'old' : 'any'), wander: 10 });
    let k = i; n.talk = async () => { await say(name.split(' ')[0], HATIM_LINES[k++ % HATIM_LINES.length]); };
  });
}
W.finishInstances();

// =====================================================================
// ambient: Facebook group, car hits, roundabouts
// =====================================================================
const WA_POOL = [
  [0, 'חנה מהקומה השלישית', 'מי החנה את הסובארו הלבנה על הדשא? הדשא בוכה.'], [0, 'סבתא רבקה', '🌸 בוקר טוב לכולם שיהיה יום מבורך ושיוסי יתקשר'], [0, 'בוריס', 'מי לקח את העגבניות שלי מהמרפסת? אני יודע מי. אני לא אומר. אבל אני יודע.'],
  [0, 'מנהל הקבוצה', 'תזכורת: הקבוצה לדברים חשובים בלבד. בלי בדיחות. בלי פוליטיקה. בלי תמונות של בוקר טוב, רבקה.'], [0, 'סבתא רבקה', '🌹 ערב טוב'], [0, 'אורנה', 'ראיתם רכב כסוף? עם שריטה? זה דחוף?? לא. אבל כן.'], [0, 'חנה מהקומה השלישית', '🚫 הפוסט הוסר על ידי מנהל הקבוצה'],
  [0, 'חנה מהקומה השלישית', 'סליחה זה היה לקבוצה אחרת. בכל אופן, מישהו מכיר אינסטלטור שלא בתל אביב?'], [0, 'אלון מהבניין ממול', 'יש פה עוד מישהו ששומע תופים מהאמפי ב-2 בלילה או שזה בראש שלי?'], [0, 'גלית', 'זה לא בראש שלך. חזרות. סליחה. בואו לפסטיבל. הכניסה לשכנים ב-10% הנחה (אין הנחה)'],
  [1, 'ציפי', 'מי שרואה חתולה ג\'ינג\'ית עם משהו נוצץ – לדווח לעירייה.'], [1, 'בוריס', 'ראיתי אותה. היא הסתכלה עליי. אני הסתכלתי עליה. אף אחד לא זז. תיקו.'],
  [2, 'שלמה הנהג', 'יוסי עבר ליד התחנה עם קורקינט. 40 קמ"ש. בכיכר. אני לא שוטר. אבל אני מתקשר לסבתא שלו.'], [2, 'סבתא רבקה', 'יוסי תאט'], [2, 'סבתא רבקה', 'יוסי תאכל'], [2, 'סבתא רבקה', 'יוסי תאט ותאכל'], [2, 'דודו', 'יש בגטים טריים. לא קשור ליוסי. גם קשור.'],
  [2, 'אלון מהבניין ממול', 'קראתי שבתל אביב דירה 7,800. זה נכון? אני משלם פה 3,200 ויש לי מרפסת ששני אנשים יכולים לריב בה.'], [2, 'פרופ\' שמשון', 'מי שיודע מאיפה יוסי קנה פלאפל ב-2019 – שלא יגיד. אני כבר יודע. אני לא ישן.'], [2, 'נועה', 'יש פה מישהו שנוסע לכיוון המרכז? אני בתחנה על 85. מאיזה יום? עזבו.'],
  [3, 'מוטי', 'מישהו ראה את הנעליים שלי מ-94\'? מידה 43. לא דחוף. 30 שנה חיכיתי, אחכה עוד.'], [3, 'חנה מהקומה השלישית', 'יוסי נכנס לקניון הישן??? מישהו צריך להתקשר למישהו!!! למי מתקשרים???'], [3, 'ציפי', 'מישהו בעירייה שמע רמקול מהקניון הישן אומר "מבצע על עגבניות". אנחנו לא יודעים איך. זה לא מחובר לחשמל.'],
  [2, 'חנה מהקומה השלישית', '📍 יוסי עשה צ׳ק-אין ברחוב. (הוא לא עשה. אני פשוט רואה אותו מהמרפסת.)'], [2, 'איציק', 'עדכון ביטחוני: השניצל של סבתא של יוסי – נוטרל. היה טעים. מבקש עוד חשוד.'], [2, 'סבתא רבקה', '📷 (תמונה: יוסי, אביב אלוש, וסבתא במרכז) תלינו במכולת'],
  [3, 'מנהל הקבוצה', 'הוחלט: מהיום הקבוצה נקראת "כרמיאלים מדברים – רק על יוסי". מי שנגד – שיכתוב. (אף אחד לא נגד)'], [3, 'בוריס', 'יוסי עבר ליד המרפסת שלי 4 פעמים היום. אני לא עוקב. אני יושב. הוא עובר. זה שונה.'], [3, 'אלון מהבניין ממול', 'מישהו יכול להגיד לי למה כולם פה כותבים על יוסי? מי זה יוסי? (הצטרפתי אתמול)'],
  [0, 'מנהל הקבוצה', 'סקר: האם יוסי יעזוב? כן – 2. לא – 211. "אכלת?" – 1 (רבקה, זו לא אפשרות)'],
  [5, 'ראש העיר', 'נפתחה כיכר חדשה. תבואו. יש עציץ. ויוסי.'], [5, 'סבתא רבקה', '📷 (תמונה של יוסי אוכל) הוכחה'], [5, 'מנהל הקבוצה', 'טוב. זה היה חשוב. מותר.'],
  [0, 'בוריס', 'מישהו חונה על העגבניות שלי. פיזית. על העגבניות. יש לי תמונה. אני לא מעלה. אני איש של מילים.'], [0, 'חנה מהקומה השלישית', 'שאלה: אם ראש העיר חונך כיכר ואף אחד לא בא – היא כיכר? (שאלה אמיתית, יש לי ויכוח עם המזגן)'],
  [0, 'ראש העיר', 'תזכורת: חנוכת כיכר מחר ב-17:00. גם מחרתיים. גם ביום שלישי. בעצם כל יום. תבואו. 🌸✂️'], [0, 'מנהל הקבוצה', 'מי שמעלה תמונות של כיכרות בלי לתייג את העירייה – הפוסט יוסר. כן, רבקה. כן, גם כשהקציצות ברקע.'],
  [0, 'אורנה', 'מצאתי רכב! לא שלי. של מישהו. הוא כסוף. מישהו רוצה? אני בשורה ד׳. אולי ה׳.'], [0, 'נוי', 'מוכר אוויר של כרמיאל. 10 שקל. מהדורת ״אחרי הגשם״ – 15. מנהל הקבוצה, זה חשוב. זה אוויר.'],
  [0, 'סופי', 'מי שבנה כיכר מול הבית שלי אתמול בלילה – זו הייתי אני. סליחה. יש מצב שראש העיר יחנוך? יש עציץ מוכן.'], [0, 'ראש העיר', 'סופי – בדרך. 🏃✂️'], [0, 'עדי אלדר', 'סופי, בזמני היו מכניסים אבן. אני מביא אבן. בלי אימוג׳י.'],
  [1, 'נועה', 'עדיין ב-85. 212 רכבים עברו. אחד צפר. ברכה? איום? רונן אומר ברכה. רונן אופטימי.'], [1, 'יובל מתל אביב', 'מישהו יודע איך יוצאים מכיכר? שאלה רצינית. שלוש שנים. אני כבר חבר בקבוצה. זה לא סימן טוב.'],
  [2, 'גריגורי', 'יוסי הפסיד לי בשחמט בארבעה מהלכים. בוריס, זה פחות ממך. תתמודד.'], [2, 'בוריס', 'גריגורי, השמש הייתה בעיניים.'], [2, 'גריגורי', 'שיחקנו בלילה. בפנים. עם וילון.'],
  [2, 'הדס · יועצת זוגית', 'מי שרב בכיכר על ״איזו יציאה״ – יש לי קבוצת תמיכה ביום שני. נפגשים באמצע הכיכר. אף אחד לא יוצא. זה הטיפול.'],
  [3, 'מנהל הקבוצה', 'מי שראה את יוסי נכנס לקניון הישן – לא לכתוב פה. יש קבוצה נפרדת: ״יוסי בקניון – עדכונים״. 190 חברים. כבר יש שלושה מנהלים.'], [3, 'עדי אלדר', 'בזמני, מי שנכנס לקניון הישן – יצא עם מכנסיים. היום? עם חותמת. הכול השתנה. הביוב אותו דבר.'],
  [3, 'מוטי', 'כיכרון הזמין פלאפל בטלפון. מהקניון. אין שם טלפון. אין שם חשמל. הוא ביקש בלי חריף. אני מביא.'],
  [5, 'חנה מהקומה השלישית', 'יוסי חזר/נשאר/לא משנה. העיקר שהוא פה. רבקה, תעלי תמונה של הקציצות. היום מותר.'], [5, 'יובל מתל אביב', 'יצאתי מהכיכר! נכנסתי לאחרת. זו עם העציץ. אני נשאר. תעדכנו את אמא שלי. היא גם בקבוצה.'],
  [0, 'מנהל הקבוצה', 'מי שכותב ״RIP״ על כיכר שנסגרה – מוסר מהקבוצה. כיכרות לא מתות. הן ממתינות. כמו רבקה ליד הטלפון.'], [0, 'אורנה', 'מצאתי את הרכב. ישב בו גבר. אמר שזה שלו. הוכיח. בכיתי. הוא הסיע אותי הביתה. נשארנו ביחד. עדיין לא מצאתי את שלי. או את בעלי. לא דחוף.'],
  [0, 'שוקי · חברה קדישא', 'מזכיר: החלקות עם נוף לכיכר האבן כמעט נגמרו. ראש העיר שריין שתיים. לו ולמספריים.'], [0, 'ויקי מהמכולת', 'שמועה בחינם: מישהו מהקבוצה גר עם אמא שלו ואומר שזה ״זמני״. 14 שנה. הוא יודע שאני יודעת. 4 שקל למי שרוצה שם.'],
  [2, 'חנה מהקומה השלישית', 'יוסי עבר ליד הבית של אסתר ולא נכנס. הבת של אסתר ראתה. רופאת השיניים. כמעט. היא סוגרת תיק. אני מדווחת כי אכפת לי.'], [2, 'בוריס', 'ראיתי את יוסי נכנס לכיכר ויוצא באותה יציאה. ככה חייתי 40 שנות נישואים. היא עוד שם. אני עוד מסתובב.'],
  [3, 'סבתא רבקה', 'יוסי נכנס לקניון הישן. אם הוא לא יוצא, הקציצות עוברות לאלון מהבניין ממול. זה לא איום. זו צוואה.'], [5, 'ויקי מהמכולת', 'יוסי חזר/נשאר. השמועה עליו ירדה ל-2 שקל. היצע וביקוש. סבתא שלו קנתה את כל המלאי.'],
];
const waUsed = new Set(); let waT = 40;
function tickWA(dt) {
  if (G.active || G.stage !== 'play') return;
  if ((waT -= dt) > 0) return; waT = 50 + Math.random() * 40;
  const act = G.done.has('END') ? 5 : G.act;
  const pool = WA_POOL.filter((m, i) => !waUsed.has(i) && (m[0] === 0 || m[0] === act || (m[0] === 2 && act === 3)));
  if (!waUsed.has('mitzi') && (G.done.has('M4') || G.done.has('M5') || G.done.has('M6'))) { waUsed.add('mitzi'); wa('מערכת', 'מיצי ביקשה להצטרף לקבוצה. אושרה אוטומטית.'); setTimeout(() => wa('מיצי', ';;;;;;;;;;;;;;;;;;'), 2000); setTimeout(() => wa('מערכת', 'מיצי הוסרה על ידי מנהל הקבוצה.'), 4000); setTimeout(() => wa('מיצי', '(ביקשה להצטרף שוב. 3 מנהלים אישרו. אף אחד לא זוכר שאישר.)'), 7000); return; }
  if (!pool.length) return; const m = pick(pool); waUsed.add(WA_POOL.indexOf(m)); wa(m[1], m[2]);
}
const HIT_LINES = ['נדרסת. הנהג אמר "סליחה". בכרמיאל גם דורסים בנימוס.', 'עפת 12 מטר. בתל אביב זה היה עולה לך 48 שקל.', 'הנהג לא ראה אותך. הוא היה עסוק בפייסבוק. בקבוצה. כתב שהוא דרס את יוסי.', 'המכונית נכנסה לכיכר. אתה היית בכיכר. הכיכר ניצחה.', 'נחתת על גג של סובארו. הלבנה. זו שחונה על הדשא. צדק פואטי.', 'הנהג צפר 3 שניות אחרי הפגיעה. ליתר ביטחון.', 'סבתא ראתה. סבתא שולחת קופסת קציצות לבית החולים. אתה לא בבית החולים. היא שולחת בכל זאת.', 'טסת מעל הכביש. חצית אותו. טכנית. זה לא נחשב.', 'Waze עדכן: זמן הגעה לתל אביב – שעה ו-45. מהאוויר.', 'נפגעת מאוטובוס קו 1. הוא יחזור לכאן בעוד 40 דקות. תזוז.', 'האוטו היה כסוף. אורנה רצה אליו: "זה שלי?" לא. אבל היא ביקשה לבדוק.', 'אמבולנס? לא צריך. יש פה 3 שכנים עם ערכת עזרה ראשונה ודעה על כל דבר.', 'הנהג היה בוריס. בקלנועית. 13 קמ"ש. זה עדיין כואב. בעיקר לאגו.', 'נחתת בכיכר, ומישהו מהעירייה שם עלייך עציץ. אתה עכשיו חלק מהתשתית.',
  'נדרסת ליד כיכר. ראש העיר הגיע תוך 40 שניות. לא בשבילך. לכיכר. הוא בדק שהיא בסדר. היא בסדר.', 'הנהג יצא, הסתכל עליך ושאל "אתה של רבקה?". אמרת כן. הוא נתן לך קופסה. היא שלחה איתו. ליתר ביטחון.', 'עפת. באוויר ראית את כל 180 הכיכרות מלמעלה. הן יוצרות צורה. היא נראית כמו ח׳.', 'נדרסת על ידי רכב כסוף. אורנה כבר שם. "זה שלי?" הנהג: "לא". אורנה: "אתה בטוח? תבדוק."', 'הנהג היה מתל אביב. הוא לא עצר. הוא צילם. סטורי. "אותנטי". 48 לייקים.', 'נדרסת ליד הטרמפיאדה. נועה: "הוא עצר לך?! הוא עצר לך?!" הוא לא עצר. הוא האט. זה שיא.',
  'נדרסת על ידי הרכב של חברה קדישא. שוקי שאל אם אתה צריך טרמפ. לא לשם. סתם טרמפ. נימוס. הוא גם השאיר כרטיס. על החזה.', 'הנהג היה שלמה. אמר "סליחה", המשיך, ועצר באותה נקודה בדיוק 40 דקות אחר כך. לוודא שאתה בסדר. לא היית. הוא רשם. הוא ימשיך לבדוק. כל 40 דקות.', 'נדרסת. הדס הייתה שם. שאלה את הנהג "מאיזו יציאה יצאת?". שלישית. היא נתנה לו כרטיס ביקור. לא לך. אתה לא בזוגיות. אתה בכביש.', 'נדרסת ליד בית העלמין. שלושה מהלוויה מחאו כפיים. חשבו שזה חלק מהטקס. ראש העיר חנך כיכר. גם זה חלק מהטקס. המת לא הגיב. הוא כבר ראה.'];
const HIT_BARKS = ['אני לא ראיתי כלום! (מצלם)', 'יוסי! קום! אתה חוסם את הכיכר!', 'זה בסדר, זה בסדר! ...זה יוסי? אז זה בסדר.', 'בעלי נפל ככה ב-98\'. היום הוא בסדר. הוא מדבר עם עציצים, אבל בסדר.', 'מישהו ראה איפה נפל לו הטלפון? יש לו הודעה מרבקה. אני רואה מפה. "אכלת?"', 'תישאר שוכב! ראש העיר בדרך! הוא חונך כיכר על כל מקום שמישהו נופל!'];
const HIT_WA = { 1: ['חנה מהקומה השלישית', 'יוסי נדרס. הוא בסדר. הנהג בסדר. הרכב בסדר. רק רציתי להיות הראשונה.'], 3: ['מנהל הקבוצה', 'פתחתי קבוצה נפרדת: "יוסי נדרס – עדכונים". הצטרפו 180 איש. גם שלושה נהגים.'], 5: ['סבתא רבקה', 'יוסי תסתכל לשני הכיוונים. בכרמיאל יש 4 כיוונים. בכיכר – 6.'], 7: ['ראש העיר', 'לאור המקרים, נציב במעבר החצייה כיכר. כיכרות מאטות תנועה. וגם מרגשות.'], 10: ['בוריס', 'יוסי נדרס 10 פעמים. זה יותר ממני ב-1987. ואני שיחקתי שחמט באמצע הכביש.'],
  15: ['שוקי · חברה קדישא', 'יוסי נדרס 15 פעמים. סטטיסטית הוא שלי. מעשית הוא עדיין זז. אני סבלני. יש לי חלקה עם נוף. שמרתי.'], 25: ['סבתא רבקה', 'יוסי נדרס 25 פעמים. הכנתי 25 קופסאות. אחת לכל פעם. זה לא עונש. זו אהבה. בטמפרטורת החדר.'] };
const nearRes = (d = 25) => npcs.filter(n => n.id.startsWith('res') && !n.hidden).map(n => [n, Math.hypot(n.h.g.position.x - P.pos.x, n.h.g.position.z - P.pos.z)]).filter(([, x]) => x < d).sort((a, b) => a[1] - b[1])[0]?.[0];
let lastHitT = -99;
traffic.onHit = (c, side) => {
  if (G.stage !== 'play' || P.interior || P.knock > 0 || UI.dState || UI.cardResolve || P.frozen) return;
  const s = Math.sign(side) || 1, hx = c.hx - c.hz * s * 0.5, hz = c.hz + c.hx * s * 0.5, l = Math.hypot(hx, hz);
  if (!knock(hx / l, hz / l, Math.max(12, c.v * 0.9), 15)) return;
  G.hits++; sfx('honk'); sfx('crash');
  toast('💥 ' + (clock.elapsedTime - lastHitT < 8 ? 'פעמיים ברצף. הנהג חזר לוודא. בכרמיאל אכפת לנו.' : pick(HIT_LINES)), 'bad'); lastHitT = clock.elapsedTime;
  const rn = nearRes(); if (rn) setTimeout(() => bark(rn, pick(HIT_BARKS)), 900);
  if (HIT_WA[G.hits]) setTimeout(() => wa(...HIT_WA[G.hits]), 2500);
  if (G.hits === 10) achieve('fly10', 'טיסה זולה', 'נדרסת 10 פעמים. זו לא טיסה לתל אביב, אבל זה בכיוון.');
  if (G.hits === 25) achieve('hit25', 'חוסן עירוני', 'נדרסת 25 פעמים. הביטוח של העירייה שלח זר פרחים. ומכתב מעורך דין. שניהם מחכים בכיכר.');
};
let rbT = 0, islandT = 0;
const lap = { rb: null, a: null, sum: 0, n: 0 };
function tickLaps() {
  let r = null; for (const q of W.ROUNDABOUTS) if (Math.abs(q.x - P.pos.x) < q.r + 12 && Math.abs(q.z - P.pos.z) < q.r + 12 && Math.hypot(q.x - P.pos.x, q.z - P.pos.z) < q.r + 10) { r = q; break; }
  if (r !== lap.rb) { lap.rb = r; lap.a = null; lap.sum = 0; lap.n = 0; return; } if (!r) return;
  const a = Math.atan2(P.pos.z - r.z, P.pos.x - r.x); if (lap.a !== null) { let d = a - lap.a; if (d > Math.PI) d -= 6.283; if (d < -Math.PI) d += 6.283; lap.sum += d; } lap.a = a;
  if (Math.abs(lap.sum) > 5.7 && !G.active) { lap.sum = 0; lap.n++;
    if (lap.n === 1) toast('🔄 סיבוב שלם בכיכר. בלי סיבה. אתה מקומי עכשיו.');
    if (lap.n === 3) wa('שלמה הנהג', 'יוסי בכיכר, סיבוב שלישי. אני בסיבוב 11. כבוד הדדי.');
    if (lap.n === 5) achieve('baker', 'נהג המאפייה', 'הקפת כיכר 5 פעמים ברצף. נהג המאפייה שלח לך לייק. מתוך הכיכר.');
    if (lap.n === 10) toast('🌀 10 סיבובים. הכיכר מתחילה לזהות אותך. היא שמחה. היא לא תיתן לך לצאת.'); }
}
function tickRoundabouts(dt) {
  if ((rbT -= dt) > 0 || P.interior) return; rbT = 0.3;
  tickLaps(); if (G.done.has('END')) $('rb-count').textContent = `${G.rb} · ביקרת ${G.rbSeen.size}/${W.ROUNDABOUTS.length}`;
  // standing still on a roundabout island long enough makes you municipal property
  const onIsland = W.ROUNDABOUTS.some(r => r.ir > 1.5 && Math.hypot(r.x - P.pos.x, r.z - P.pos.z) < r.ir) && Math.hypot(P.vel.x, P.vel.z) < 0.5;
  islandT = onIsland ? islandT + 0.3 : 0;
  if (islandT > 20 && !EV.has('plant')) { EV.add('plant'); toast('🪴 עמדת על אי תנועה 20 שניות. העירייה רשמה אותך כעציץ. יש לך מספר מלאי. ישקו אותך ביום שלישי.'); achieve('plant', 'עציץ עירוני', 'עמדת באמצע כיכר עד שהפכת לחלק ממנה. ראש העיר גאה. הוא לא יודע למה.'); }
  for (const r of W.ROUNDABOUTS) if (Math.abs(r.x - P.pos.x) < r.r + 4 && Math.abs(r.z - P.pos.z) < r.r + 4 && Math.hypot(r.x - P.pos.x, r.z - P.pos.z) < r.r + 3) { if (!G.rbSeen.has(r)) { G.rbSeen.add(r); if (G.rbSeen.size % 10 === 0) toast(`🧭 ביקרת ב-${G.rbSeen.size} כיכרות. בזמן שקראת את זה, ראש העיר חנך עוד שתיים.`); if (!G.active && G.stage === 'play' && Math.random() < 0.06) eventMayorRb(r); if (G.rbSeen.size === 50) achieve('rb50', 'אנטומיה של כיכר', `עברת ב-50 כיכרות. נשארו רק ${W.ROUNDABOUTS.length - 50}.`); } }
  if (UI.stats.savtaAsked >= 15) achieve('eat', 'אכלת?', 'סבתא שאלה אותך "אכלת?" 15 פעמים. ענית "כן" 15 פעמים. שיקרת 15 פעמים.');
}
const LOOP_LINES = ['הלכת שעות... והגעת בחזרה הביתה.', 'כל הדרכים מובילות לכרמיאל.', 'הגליל החזיר אותך בעדינות.', 'הגעת לסוף העיר. יש שם שלט: "אתה עדיין בכרמיאל".', 'ניסית לצאת מצד אחר. הגליל הסתובב איתך. הוא מיומן. הוא עשה את זה לדוד שלך ב-94\'.', 'יצאת מכרמיאל ונכנסת לכרמיאל. זו לא טעות ניווט. זו כרמיאל. Waze מתנצל. בפעם הראשונה.'];
// ---------------------------------------------------------------- passers-by react (throttled)
let reactT = 0, sprintT = 0, jumps = 0;
function tickReactions(dt) {
  if (G.stage !== 'play' || P.interior || UI.dState) return;
  if (!P.onScooter && pressed.has('Space') && P.vel.y > 5 && ++jumps === 50) achieve('jump50', 'קופץ סדרתי', 'קפצת 50 פעם. מעל אדניות, מעל רגשות, מעל ההיגיון. ראש העיר שוקל כיכר אווירית.');
  const running = !P.onScooter && Math.hypot(P.vel.x, P.vel.z) > 11; sprintT = running ? sprintT + dt : 0;
  if ((reactT -= dt) > 0) return;
  const n = nearRes(10); if (!n) return;
  let line = null;
  if (P.onScooter && Math.abs(P.speed) > 18) line = pick(['יוסי! זה מדרכה! ...טוב, אצלנו זה גם כביש. תמשיך.', 'בגילך הייתי עם אופניים. בלי חשמל. בלי בלמים. בלי הורים.']);
  else if (sprintT > 6) line = G.done.has('M7') ? 'רץ ככה? כיכרון אחריך? אל תענה. אני לא רוצה לדעת.' : 'בכרמיאל לא רצים. ממה אתה בורח?';
  else if (!P.onGround && !P.onScooter && Math.hypot(n.h.g.position.x - P.pos.x, n.h.g.position.z - P.pos.z) < 5) line = 'קפצת מעל האדנית שלי?! יוסי, יש בה עציץ של ראש העיר!';
  if (line) { bark(n, line); reactT = 20; }
}
// ---------------------------------------------------------------- random world events (once each, 60 s apart)
const EV = new Set(); let evCool = 30, stillT = 0, savtaT = 240;
const nearP = (p, d) => p && Math.hypot(p.x - P.pos.x, p.z - P.pos.z) < d;
function fire(id, fn) { if (EV.has(id) || evCool > 0) return; EV.add(id); evCool = 60; fn(); }
function eventMayorRb(r) {
  if (EV.has('rbmayor' + G.rbSeen.size) || evCool > 0) return; EV.add('rbmayor' + G.rbSeen.size); evCool = 60;
  const m = placeNPC('mayor', r.x + r.r + 3, r.z); m.pose = 'point'; bark(m, 'רגע! לא לעבור! עוד לא חנכנו!');
  setTimeout(() => openRoundabout('כיכר ' + pick(['הרגע', 'הספונטנית', 'שעברת-בה-במקרה'])), 1500);
  setTimeout(() => placeNPC('mayor', LM.cityhall.mayor.x, LM.cityhall.mayor.z), 9000);
}
async function savtaAmbush() {
  const s = placeNPC('savta', P.pos.x + Math.sin(P.yaw) * 5, P.pos.z + Math.cos(P.yaw) * 5, P.yaw + Math.PI);
  UI.busy = true; P.frozen = true;
  try {
    await say('סבתא רבקה', 'אכלת?'); const c = await ask('יוסי', '...', ['"כן."', '"לא."']);
    await say('סבתא רבקה', c ? pick(['ידעתי. (מוציאה קופסה מהעגלה. העגלה לא הייתה פה לפני שנייה.)', 'לא אכלת. ידעתי. גם סבא שלך לא אכל ביום שהוא הלך. אני לא אומרת שיש קשר. אני אומרת "קח".', 'לא אכלת? (קופסה. גדולה. רועדת. היא חיה. היא יותר חיה ממך.)'])   // "לא"
      : pick(['שקרן.', 'שקרן. יש לך פנים של אחד שהכיכרות אוכלות אותו. (קופסה.)', 'אכלת? יופי. אז זה לאחר כך. (הקופסה כבדה. יש בה גם מכתב. אל תפתח לפני שאני מתה. אני לא מתכננת.)', 'אכלת אצל מי? אצל דודו? זה לא אוכל, זה בגט. אוכל זה כשמישהו בוכה בזמן שהוא מבשל. קח. בכיתי.']));   // "כן"
  }
  finally { UI.busy = false; P.frozen = false; setTimeout(() => hideNPC('savta'), 2500); }
}
// walking through the passage under one of the ח-shaped "החתים"
let chetIn = null;
const CHET_TOASTS = ['🏢 עברת מתחת לח׳. זה כמו שער ניצחון, רק עם כביסה תלויה.', '🏢 שוב מתחת לח׳. דיירי הקומה ה-9 מנופפים. אחד מהם זורק לך מלפפון.', '🏢 בחתים יש הד. צעקת "שלום". שלוש סבתות ענו "אכלת?".'];
let chetN = 0;
function tickChet() {
  let inside = null;
  for (const h of W.CHETS) { const dx = P.pos.x - h.x, dz = P.pos.z - h.z, a = dx * h.ux + dz * h.uz, b = -dx * h.uz + dz * h.ux; if (Math.abs(a) < h.L * 0.13 && Math.abs(b) < h.Wd / 2) inside = h; }
  if (inside && inside !== chetIn && G.stage === 'play') { const L = [...HATIM.toasts, ...CHET_TOASTS]; toast(L[chetN++ % L.length]); }
  chetIn = inside;
}
function tickEvents(dt) {
  if (!P.interior) tickChet();
  if (G.stage !== 'play' || G.active || P.interior || UI.dState || UI.cardResolve || UI.busy) return;
  evCool -= dt; savtaT -= dt;
  stillT = Math.hypot(P.vel.x, P.vel.z) < 0.3 && !P.onScooter ? stillT + dt : 0;
  if (stillT > 45) { stillT = -600; fire('still', () => wa('חנה מהקומה השלישית', `יוסי עומד בלי לזוז כבר דקה ב${W.streetAt(P.pos.x, P.pos.z) || 'רחוב'}. מישהו לבדוק? לא אני, יש לי עוף בתנור.`)); }
  if (G.act >= 2 && savtaT < 0 && !P.onScooter && Math.hypot(P.vel.x, P.vel.z) > 2) { savtaT = 300; if (evCool <= 0) { evCool = 60; savtaAmbush(); } }
  if (P.onScooter && nearP(W.POI.japanese, 40)) fire('japanese', () => { P.speed *= 0.4; toast('🎋 בגן היפני הקורקינט מוריד הילוך מעצמו. מכבוד. אפילו הוא מבין.'); });
  if (!G.done.has('S2') && nearP(LM.tremp.stop, 60)) fire('noa85', () => bark(npc('noa'), 'טרמפ?! ...לא? טוב. גם ביום שלישי אמרו לא.'));
  if (P.onScooter && nearP(W.POI.big, 90)) fire('ornabig', () => bark(npc('orna'), 'זה שלי?! ...לא. זה קורקינט. אבל הוא כסוף בנשמה.'));
  if (nearP(W.POI.lev, 50)) fire('lev', () => pa('הקניון החדש מודיע: 10% הנחה למי שמתחייב להישאר. 20% למי שמביא את יוסי. חי.', false));
  if (G.done.has('M5') && nearP(W.POI.galilPark, 60)) fire('galdance', () => { const d = npcs.filter(n => n.id.startsWith('res') && nearP(n.h.g.position, 40)).slice(0, 3); d.forEach(n => { n.dance = true; setTimeout(() => n.dance = false, 10000); }); if (d[0]) bark(d[0], 'יוסי! רגל שמאל! ...השנייה!'); });
  if (G.done.has('M7') && Math.random() < dt / 200) fire('mitzi2', () => { mitziRun(P.pos, 40); setTimeout(() => wa('ראש העיר', 'החצי השני של המספריים נעלם. מיצי, אני יודע שזאת את. יש לי כיכר ביום שלישי.'), 2000); });
  if (nearP(LM.bus, 40)) fire('bus1', () => toast('🚌 קו 1 עבר לידך. שלמה נופף. זו הפעם הרביעית היום. הוא לא נסע לשום מקום. הוא מאושר.'));
  if (nearP(W.POI.braude, 70)) fire('braude', () => { const n = nearRes(30); if (n) bark(n, 'אתה סטודנט? יש לי נוכחות למלא. לא שלי. של דניאל. הוא פה מ-2015. הוא בכיתה. הוא ישן.', 5); });
  if (P.onScooter && Math.abs(P.speed) > 28) fire('speed', () => { toast('🛴 שיא מהירות עירוני. שלמה ראה. הוא לא מתרשם. הוא בכיכר. אתה גם תהיה.', 'good'); achieve('speed', 'מהיר מקו 1', 'הגעת למהירות המקסימלית של הקורקינט. העירייה מתקינה כיכר על המקום. לכבודך. ולהאטה.'); });
  if (nearP(LM.cityhall.ribbon, 5)) fire('ribbon', () => toast('🎀 הסרט הנצחי של העירייה. נגזר כל יום ב-17:00, נתפר כל לילה ב-02:00. ציפי תופרת. יש לה אצבעות של קבלה.'));
  if (P.onScooter && G.done.has('M2') && nearP(LM.gate, 25)) fire('itzikScooter', () => bark(npc('itzik'), 'יוסי! בדקתי את הקורקינט בעיניים! הוא נראה בסדר! לא בדקתי מקרוב! הוא ממצמץ!', 5));
  if (G.act >= 2 && nearP(W.POI.big, 60) && !P.onScooter) fire('bigLost', () => toast('🅿️ ביג כרמיאל. 400 רכבים. 380 כסופים. אורנה מברכת אותך בכניסה ושוכחת אותך ביציאה. כמו החניון.'));
}
let looping = false, loops = 0;
async function loopBack() {
  if (looping) return; looping = true; fade(true); await sleep(700);
  teleport(LM.home.x, LM.home.z, LM.home.face); fade(false); loops++; toast('🌀 ' + (loops >= 5 ? 'פעם חמישית בקצה העיר. הגבול שם שלט חדש: "יוסי, מספיק".' : LOOP_LINES[(loops - 1) % LOOP_LINES.length])); looping = false;
}

// a promise that dies inside a talk/mission would otherwise fail silently — surface it
addEventListener('unhandledrejection', e => { console.error(e.reason); toast(`⚠️ שגיאה: ${e.reason?.message || e.reason}`, 'bad', 7000); });

// =====================================================================
// input: dialogs, map, pause
// =====================================================================
let mapOpen = false, paused = false;
addEventListener('keydown', e => {
  if (e.repeat || G.stage === 'title') return;
  if (mg.key && mg.key(e)) { pressed.delete(e.code); return; }
  if (UI.cardResolve && ['Space', 'Enter', 'KeyE'].includes(e.code)) { pressed.delete(e.code); UI.cardResolve(); return; }
  if (UI.dState) {
    pressed.delete(e.code);
    const d = UI.dState, n = parseInt(e.key);
    if (d.choices && d.shown && n >= 1 && n <= d.choices.length) closeDialog(n - 1);
    else if (['Space', 'Enter', 'KeyE'].includes(e.code)) advance();
    return;
  }
  if (e.code === 'KeyM' && !P.interior && !paused) toggleMap();
  if (e.code === 'Escape') { if (mapOpen) toggleMap(); else togglePause(); }
});
function toggleMap() {
  mapOpen = !mapOpen; $('bigmap').classList.toggle('hidden', !mapOpen);
  if (mapOpen) { UI.stats.mapOpened++; if (UI.stats.mapOpened === 20) achieve('waze', 'שעה ו-45', 'פתחת את המפה 20 פעם. Waze לא השתנה.'); drawBigMap(P.pos.x, P.pos.z, P.yaw, M.targets); }
}
let pausedOnce = false;
function togglePause() { paused = !paused; $('pause').classList.toggle('hidden', !paused); if (paused && !pausedOnce && G.stage === 'play') { pausedOnce = true; setTimeout(() => toast('⏸️ המשחק בהפסקה. כרמיאל לא. ראש העיר חנך כיכר בזמן שהלכת לשתות.'), 300); } }
$('p-resume').onclick = togglePause;
$('p-sound').onclick = () => { setMuted(!audio.muted); $('p-sound').textContent = audio.muted ? '🔇 צלילים: כבוי' : '🔊 צלילים: פועל'; };
$('p-shadows').onclick = () => { renderer.shadowMap.enabled = !renderer.shadowMap.enabled; sun.castShadow = renderer.shadowMap.enabled; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); $('p-shadows').textContent = renderer.shadowMap.enabled ? '🌗 צללים: פועל' : '🌗 צללים: כבוי'; };
$('p-quality').onclick = () => { const hi = renderer.getPixelRatio() > 1.1; renderer.setPixelRatio(hi ? 1 : Math.min(devicePixelRatio, 1.75)); $('p-quality').textContent = hi ? '⚡ איכות: מהירה' : '✨ איכות: גבוהה'; };

// =====================================================================
// beacons (golden beams over objectives)
// =====================================================================
const beacons = Array.from({ length: 6 }, () => {
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 220, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  b.visible = false; scene.add(b); return b;
});

// =====================================================================
// interactions (E / Q prompts)
// =====================================================================
async function runTalk(fn) { UI.busy = true; try { await fn(); } finally { UI.busy = false; } }
function interactions() {
  if (UI.dState || UI.cardResolve || UI.busy || P.frozen || G.stage !== 'play') { prompt(null); return; }
  const tips = [];
  let best = null, bd = 1e9;
  const n = nearestNPC(P.pos);
  if (n) { best = { label: `לדבר עם ${n.name.split(' · ')[0]}`, go: () => { n.talking = true; n.h.g.rotation.y = Math.atan2(P.pos.x - n.h.g.position.x, P.pos.z - n.h.g.position.z); P.yaw = Math.atan2(n.h.g.position.x - P.pos.x, n.h.g.position.z - P.pos.z); runTalk(n.talk).finally(() => n.talking = false); } }; bd = Math.hypot(n.h.g.position.x - P.pos.x, n.h.g.position.z - P.pos.z); }
  for (const [, h] of M.hots) { if (h.cond && !h.cond()) continue; const d = Math.hypot(h.x - P.pos.x, h.z - P.pos.z); if (d < h.r && d < bd) { bd = d; best = { label: h.label, go: () => runTalk(h.onE) }; } }
  if (horror.active && nearNest()) best = { label: 'לדבר עם מיצי (החותמת!)', go: null };
  if (best) tips.push(`<kbd>E</kbd>${best.label}`);
  if (nearScooter()) tips.push('<kbd>Q</kbd>לעלות על הקורקינט');
  else if (P.onScooter) tips.push('<kbd>Q</kbd>לרדת · <kbd>W</kbd>/<kbd>S</kbd> גז/ברקס');
  prompt(tips.join(' &nbsp; '));
  if (pressed.has('KeyE') && best?.go) best.go();
  if (pressed.has('KeyQ')) { if (P.onScooter) dismount(); else if (nearScooter()) mount(); }
}

// =====================================================================
// title screen & boot
// =====================================================================
const TITLE_SUBS = ['משחק על עיר אחת, 180 כיכרות ובחור אחד שחשב שאפשר לצאת.', 'מבוסס על סיפור אמיתי. הכיכרות אמיתיות. השאר – כמעט.', 'בכרמיאל אף אחד לא נשאר בלי כיכר. או בלי סבתא. או בלי קופסה.', 'Waze: שעה ו-45. תמיד. גם מהתפריט הראשי.', '186 כיכרות, 16 פיצריות, חתולה אחת עם חותמת.'];
let subI = 0; setInterval(() => { $('t-sub').textContent = TITLE_SUBS[++subI % TITLE_SUBS.length]; }, 4500);
const save = loadSave();
$('t-continue').disabled = !save;
function begin() { document.body.classList.add('playing'); ac(); $('title').classList.add('hidden'); showHUD(true); music('roam'); refreshBlips(); }
// new game: pick the hero's name first (letters, spaces and hyphens only — it is shown inside HTML)
$('t-new').onclick = () => { $('namebox').classList.remove('hidden'); $('name-input').focus(); };
let gender = 'm';
const DEFAULT_NAME = { m: 'יוסי', f: 'רותי' };   // used if the name field is left empty
function setGenderUI(g) {
  gender = g; document.querySelectorAll('.gender .g').forEach(b => b.classList.toggle('on', b.dataset.g === g));
}
document.querySelectorAll('.gender .g').forEach(b => b.onclick = () => setGenderUI(b.dataset.g));
setGenderUI('m');
function startNamed() {
  const n = $('name-input').value.trim().replace(/\s+/g, ' ') || DEFAULT_NAME[gender];
  if (!/^[֐-׿a-zA-Z' -]{1,14}$/.test(n)) { $('name-err').textContent = 'רק אותיות, עד 14 תווים. סבתא לא יודעת לקרוא אימוג׳י.'; return; }
  $('namebox').classList.add('hidden'); setName(n, gender); begin(); try { localStorage.removeItem('karmiel-save'); } catch {} resetTreasures(); newGame();
  if (n !== 'יוסי') setTimeout(() => toast(`👵 סבתא שמרה את השם: <b>${n}</b>. היא כבר סיפרה לכל הפייסבוק.`, 'good', 6000), 1500);
  if (gender === 'f') setTimeout(() => wa('חנה מהקומה השלישית', `רגע, ${n} זאת בת? כל הזמן כתבו פה "הוא". מנהל הקבוצה, תתקן!!!`), 9000);
}
$('name-go').onclick = startNamed;
$('name-input').addEventListener('keydown', e => { if (e.key === 'Enter') startNamed(); });
$('t-continue').onclick = () => { const s = loadSave(); if (!s) return; begin(); continueGame(s); };
$('t-settings').onclick = () => togglePause();
let exitClicks = 0;
$('t-exit').onclick = () => { const n = ++exitClicks; toast(n === 1 ? '🚪 אי אפשר לצאת מכרמיאל. זה כל העניין.' : n === 2 ? '🚪 ניסית שוב. זה חמוד. גם יוסי ככה.' : n === 3 ? '✂️ ראש העיר חנך כיכר לכבוד הניסיון שלך: "כיכר הכפתור".' : n === 4 ? '🍅 בוריס מהמרפסת: "הוא לוחץ שוב. תביאו עגבניות."' : n >= 7 ? '👵 סבתא: "אכלת?" (הכפתור הזה עכשיו שייך לה.)' : '🚪 טוב. יוצאים. ...(סיבוב) הגעת לתפריט הראשי. מכל כיכר חוזרים לאותו מקום.', 'bad'); };
$('loading').classList.add('hidden');

// =====================================================================
// main loop
// =====================================================================
const clock = new THREE.Clock(); let t = 0, locT = 0;
const focus = new THREE.Vector3();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05); t += dt;
  if (G.stage === 'title') {
    const c = W.POI.cityhall, a = t * 0.04;
    camera.position.set(c.x + Math.sin(a) * 700, 260, c.z + Math.cos(a) * 700); camera.lookAt(c.x, 40, c.z - 150);
    focus.set(c.x, 40, c.z); updateSky(focus, dt); renderer.render(scene, camera); pressed.clear(); return;
  }
  if (paused || mapOpen) { if (mapOpen && Math.floor(t * 4) !== Math.floor((t - dt) * 4)) drawBigMap(P.pos.x, P.pos.z, P.yaw, M.targets); pressed.clear(); renderer.render(scene, camera); return; }
  const talking = UI.dState || UI.cardResolve;
  let hs = 0;
  if (cutscene.train) cutscene.train(dt);
  else {
    if (!talking) hs = updatePlayer(dt); else { P.vel.x = P.vel.z = 0; if (P.onScooter) P.speed = 0; }
    updateCamera(dt);
  }
  syncPlayer(hs, t, dt);
  if (!P.interior) updateTraffic(dt, P);
  updateNPCs(dt, t, P);
  updateHorror(dt, t);
  tickWaiters(); for (const h of M.hooks) h(dt);
  tickItems(t); tickCat(dt, t); tickBakery(dt); tickBlocks(t); tickTreasures(dt, t, G.stage === 'play'); tickPizza(dt, P, G.stage === 'play');
  tickDialog(dt); tickTimer(); tickWA(dt); tickRoundabouts(dt); tickReactions(dt); tickEvents(dt);
  interactions();
  // world dressing animation
  FLAGS.forEach((f, i) => f.rotation.y = Math.sin(t * 2 + i) * 0.25);
  if (LM.kikarLamp) LM.kikarLamp.material.emissiveIntensity = Math.random() < 0.06 ? 0 : 1;
  LM.spots?.forEach((s, i) => s.rotation.y = t * 2 + i);
  // beacons
  const tg = P.interior || cutscene.train ? [] : M.targets;
  if (tg.length && G.done.has('M1') && !G.flags.beaconJoke) { G.flags.beaconJoke = true; toast('💡 עמוד אור זהב מסמן את היעד. העירייה התקינה אותו. הוא עלה 4 מיליון. יש בו עציץ.'); }
  beacons.forEach((b, i) => { const p = tg[i]; b.visible = !!p; if (p) { b.position.set(p.x, W.groundAt(p.x, p.z) + 110, p.z); b.material.opacity = clamp((Math.hypot(p.x - camera.position.x, p.z - camera.position.z) - 8) / 80, 0.04, 0.3); } });
  // HUD
  if (scooter.unlocked && !P.onScooter) setBlip('scooter', scooter.pos.x, scooter.pos.z, '🛴', '#2ecc71', 'הקורקינט'); else removeBlip('scooter');   // where you left it, always current
  if (!P.interior && !cutscene.train) {
    drawRadar(P.pos.x, P.pos.z, P.yaw, cam.yaw, M.targets, P.onScooter ? 1.7 : 1, t);
    if ((locT -= dt) <= 0) { locT = 0.5; setLocation(W.streetAt(P.pos.x, P.pos.z), W.placeAt(P.pos.x, P.pos.z)); }
    const B = W.BOUNDS; if (G.stage === 'play' && (P.pos.x < B.x0 - 120 || P.pos.x > B.x1 + 120 || P.pos.z < B.z0 - 120 || P.pos.z > B.z1 + 120)) loopBack();
  } else if (P.interior) { setLocation('הקניון הישן', 'קומה נשכחת'); if (Math.random() < 0.2) radarNoSignal(); }
  $('waze-eta').textContent = G.done.has('END') ? '0:00 – אתה בבית' : 'שעה ו-45';
  focus.copy(cutscene.train ? LM.train.g.position : P.pos);
  updateSky(focus, dt);
  renderer.render(scene, camera);
  pressed.clear();
}
loop();
window.__k = { G, P, M, UI, W, LM, npcs, horror, teleport, mg, cam };
