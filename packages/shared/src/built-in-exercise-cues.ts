import { BUILT_IN_EXERCISES } from './built-in-exercises.ts'
import type { ExerciseCues } from './schemas/exercise.ts'

// Two or three form cues per built-in exercise, in both languages, in the order
// of BUILT_IN_EXERCISES (index 0 is ID 1). A test keeps the two arrays aligned.
export const BUILT_IN_EXERCISE_CUES: readonly ExerciseCues[] = [
  {
    zh: [
      '肩胛骨后收下沉，上背贴紧凳面',
      '杠铃下放到胸口中下部，前臂保持垂直',
      '脚踩实地面，臀部不离开凳子',
    ],
    en: [
      'Pull the shoulder blades back and down into the bench',
      'Lower the bar to the lower chest with forearms vertical',
      'Keep feet planted and hips on the bench',
    ],
  },
  {
    zh: ['凳子调到 30–45 度', '杠铃下放到锁骨下方的上胸', '肩胛骨保持收紧，不要耸肩'],
    en: [
      'Set the bench to 30–45 degrees',
      'Lower the bar to the upper chest below the collarbones',
      'Keep the shoulder blades set; do not shrug',
    ],
  },
  {
    zh: [
      '哑铃下放到胸部两侧，手肘约 45 度',
      '底部稍作停顿，感受胸部拉伸',
      '推起时哑铃向中间靠拢但不相碰',
    ],
    en: [
      'Lower the dumbbells beside the chest, elbows at about 45 degrees',
      'Pause briefly at the bottom to feel the stretch',
      'Press up and in without clanking the dumbbells',
    ],
  },
  {
    zh: ['凳子调到 30–45 度', '手肘在哑铃正下方', '下放到上胸两侧，控制速度'],
    en: [
      'Set the bench to 30–45 degrees',
      'Keep the elbows under the dumbbells',
      'Lower to the sides of the upper chest under control',
    ],
  },
  {
    zh: ['调整座椅，让把手与胸部中下部平齐', '背部贴紧靠背', '推到手臂接近伸直，慢慢回放'],
    en: [
      'Set the seat so the handles line up with the mid chest',
      'Keep the back against the pad',
      'Press until the arms are nearly straight, then return slowly',
    ],
  },
  {
    zh: ['身体稍微前倾，重点练胸', '下降到肩膀略低于手肘', '肩部不适就减小幅度'],
    en: [
      'Lean the torso forward slightly to bias the chest',
      'Descend until the shoulders are just below the elbows',
      'Shorten the range if the shoulders hurt',
    ],
  },
  {
    zh: ['身体从头到脚成一条直线', '手略宽于肩，手肘约 45 度', '胸口贴近地面再推起'],
    en: [
      'Keep a straight line from head to heels',
      'Hands slightly wider than shoulders, elbows at about 45 degrees',
      'Bring the chest close to the floor, then push up',
    ],
  },
  {
    zh: ['手肘保持微屈，角度不变', '像抱大树一样打开和合拢', '下放到胸部有拉伸感即可，不要过低'],
    en: [
      'Keep a slight, fixed bend in the elbows',
      'Open and close the arms as if hugging a tree',
      'Stop at a good chest stretch; do not drop too low',
    ],
  },
  {
    zh: ['身体稍前倾，一脚在前站稳', '手肘微屈，双手在胸前合拢', '回放时控制，感受胸部拉伸'],
    en: [
      'Lean forward slightly in a split stance',
      'Keep the elbows slightly bent and bring the hands together in front',
      'Control the return and feel the chest stretch',
    ],
  },
  {
    zh: ['调整座椅，让把手与胸部平齐', '手肘微屈，用胸发力合拢', '合拢时停顿一秒'],
    en: [
      'Set the seat so the handles are at chest height',
      'Keep the elbows soft and squeeze with the chest',
      'Hold the squeeze for a second',
    ],
  },
  {
    zh: [
      '杠铃贴近小腿，位于脚掌中部上方',
      '起拉前收紧背部，背保持平直',
      '用腿推地站起，杠铃全程贴身',
    ],
    en: [
      'Start with the bar over mid-foot, close to the shins',
      'Brace and flatten the back before the pull',
      'Push the floor away and keep the bar against the body',
    ],
  },
  {
    zh: ['正手握，略宽于肩', '先沉肩，再把胸口拉向横杆', '下放到手臂伸直，不要借力摆动'],
    en: [
      'Overhand grip slightly wider than shoulders',
      'Set the shoulders down, then pull the chest to the bar',
      'Lower to straight arms without swinging',
    ],
  },
  {
    zh: ['反手握，与肩同宽', '拉到下巴过杆', '下放时控制，手臂完全伸直'],
    en: [
      'Underhand grip at shoulder width',
      'Pull until the chin clears the bar',
      'Lower under control to straight arms',
    ],
  },
  {
    zh: ['握距略宽于肩，身体微微后仰', '把横杆拉到上胸，手肘向下向后', '回放时让肩胛骨向上伸展'],
    en: [
      'Grip slightly wider than shoulders and lean back a little',
      'Pull the bar to the upper chest, driving the elbows down and back',
      'Let the shoulder blades rise on the way up',
    ],
  },
  {
    zh: ['屈髋俯身约 45 度，背部平直', '把杠铃拉向肚脐', '不要用身体起伏借力'],
    en: [
      'Hinge to about 45 degrees with a flat back',
      'Row the bar to the navel',
      'Do not heave with the torso',
    ],
  },
  {
    zh: ['一手一膝撑在凳上，背部平直', '把哑铃拉向髋部', '顶部停顿，再慢慢放下'],
    en: [
      'Support one hand and knee on the bench with a flat back',
      'Row the dumbbell toward the hip',
      'Pause at the top, then lower slowly',
    ],
  },
  {
    zh: ['坐直，胸口挺起', '把把手拉向腹部，肩胛骨夹紧', '回放时手臂伸直，身体不要前后摆'],
    en: [
      'Sit tall with the chest up',
      'Pull the handle to the stomach and squeeze the shoulder blades',
      'Return to straight arms without rocking',
    ],
  },
  {
    zh: ['屈髋俯身，背部平直', '把杠头拉向胸口下方', '手肘贴近身体'],
    en: [
      'Hinge forward with a flat back',
      'Pull the bar toward the lower chest',
      'Keep the elbows close to the body',
    ],
  },
  {
    zh: ['胸口贴紧靠垫', '手肘向后拉，肩胛骨夹紧', '慢慢回放，感受背部拉伸'],
    en: [
      'Keep the chest on the pad',
      'Drive the elbows back and squeeze the shoulder blades',
      'Return slowly and feel the back stretch',
    ],
  },
  {
    zh: ['手臂伸直，手肘微屈', '用背部把绳索压到大腿', '身体稍微前倾，躯干不动'],
    en: [
      'Arms straight with a slight elbow bend',
      'Use the back to sweep the handle to the thighs',
      'Lean forward slightly and keep the torso still',
    ],
  },
  {
    zh: ['站直，杠铃贴着大腿', '肩膀垂直向上耸', '顶部停顿，不要转动肩膀'],
    en: [
      'Stand tall with the bar against the thighs',
      'Shrug the shoulders straight up',
      'Pause at the top; do not roll the shoulders',
    ],
  },
  {
    zh: ['垫子放在髋骨下方', '从髋部向前弯，背部平直', '起身到身体成一直线，不要过度后仰'],
    en: [
      'Set the pad below the hip bones',
      'Hinge at the hips with a flat back',
      'Rise to a straight line; do not overarch',
    ],
  },
  {
    zh: [
      '握距略宽于肩，臀部和腹部收紧',
      '杠铃沿直线推过头顶，头稍后让',
      '顶部时杠铃在脚掌中部正上方',
    ],
    en: [
      'Grip just outside the shoulders; brace the glutes and abs',
      'Press in a straight line and move the head back slightly',
      'Finish with the bar over mid-foot',
    ],
  },
  {
    zh: ['坐直，背部贴紧靠背', '哑铃从耳朵旁推起', '不要完全锁死手肘'],
    en: [
      'Sit tall with the back on the pad',
      'Press the dumbbells up from ear height',
      'Do not lock the elbows hard',
    ],
  },
  {
    zh: ['调整座椅，让把手与肩平齐', '背部贴紧靠背', '推起时不要耸肩'],
    en: [
      'Set the seat so the handles are at shoulder height',
      'Keep the back against the pad',
      'Do not shrug as you press',
    ],
  },
  {
    zh: ['起始时手心朝向自己', '推起时转动手腕，到顶部手心朝前', '控制下放，转回起始位置'],
    en: [
      'Start with the palms facing you',
      'Rotate the palms forward as you press',
      'Lower under control and rotate back',
    ],
  },
  {
    zh: ['手肘微屈，略高于手腕', '向两侧抬到与肩同高', '慢慢放下，不要借身体甩'],
    en: [
      'Keep a slight elbow bend, elbows above the wrists',
      'Raise to the sides up to shoulder height',
      'Lower slowly without swinging',
    ],
  },
  {
    zh: ['身体侧对绳索，手从身体前方拉起', '抬到与肩同高', '全程保持张力，慢慢回放'],
    en: [
      'Stand side-on and start with the hand in front of the body',
      'Raise to shoulder height',
      'Keep tension and return slowly',
    ],
  },
  {
    zh: ['手肘微屈', '向前抬到与肩同高', '不要后仰借力'],
    en: [
      'Keep a slight elbow bend',
      'Raise in front to shoulder height',
      'Do not lean back to swing',
    ],
  },
  {
    zh: ['俯身，背部平直', '手肘微屈，向两侧打开', '用后肩发力，不要夹背'],
    en: [
      'Hinge forward with a flat back',
      'Open the arms to the sides with soft elbows',
      'Lead with the rear delts; do not squeeze the back',
    ],
  },
  {
    zh: ['绳索调到与脸同高', '把绳子拉向额头，双手向两侧分开', '手肘高于手腕'],
    en: [
      'Set the cable at face height',
      'Pull the rope toward the forehead and spread the hands apart',
      'Keep the elbows above the wrists',
    ],
  },
  {
    zh: ['手肘贴紧身体两侧', '弯举到顶部收紧二头', '慢慢放下到手臂伸直'],
    en: [
      'Pin the elbows to the sides',
      'Curl up and squeeze the biceps',
      'Lower slowly to straight arms',
    ],
  },
  {
    zh: ['手肘固定在身体两侧', '上举时手腕外转，手心朝上', '不要用身体摆动借力'],
    en: [
      'Keep the elbows fixed at the sides',
      'Turn the palms up as you curl',
      'Do not swing the body',
    ],
  },
  {
    zh: ['手心相对，像握锤子一样', '手肘固定不动', '慢慢放下'],
    en: ['Palms facing each other like holding a hammer', 'Keep the elbows still', 'Lower slowly'],
  },
  {
    zh: ['凳子调到约 45 度，手臂自然下垂', '上臂保持不动', '在底部充分伸展'],
    en: [
      'Set the bench to about 45 degrees and let the arms hang',
      'Keep the upper arms still',
      'Get a full stretch at the bottom',
    ],
  },
  {
    zh: ['上臂贴紧垫子', '下放到手臂接近伸直', '不要让手肘离开垫子'],
    en: [
      'Keep the upper arms on the pad',
      'Lower until the arms are nearly straight',
      'Do not lift the elbows off the pad',
    ],
  },
  {
    zh: ['站在绳索前，手肘贴近身体', '弯举到顶部停顿', '全程保持张力'],
    en: [
      'Stand facing the cable with elbows close to the body',
      'Pause at the top',
      'Keep tension throughout',
    ],
  },
  {
    zh: ['上臂贴紧身体两侧', '下压到手臂完全伸直', '回放时手肘不要向前移动'],
    en: [
      'Pin the upper arms to the sides',
      'Press down to full extension',
      'Do not let the elbows drift forward on the way up',
    ],
  },
  {
    zh: ['上臂与地面垂直或稍向后倾', '只弯曲手肘，把杠铃下放到额头上方', '手肘不要向外张开'],
    en: [
      'Keep the upper arms vertical or slightly back',
      'Bend only at the elbows, lowering to just above the forehead',
      'Do not flare the elbows',
    ],
  },
  {
    zh: ['背对绳索，上臂贴近头部', '在头后充分伸展', '伸直手臂时不要动上臂'],
    en: [
      'Face away from the cable with upper arms near the head',
      'Get a full stretch behind the head',
      'Keep the upper arms still as you extend',
    ],
  },
  {
    zh: ['双手握住一个哑铃举过头顶', '下放到头后，手肘指向前方', '伸直时收紧三头'],
    en: [
      'Hold one dumbbell overhead with both hands',
      'Lower behind the head with elbows pointing forward',
      'Squeeze the triceps at the top',
    ],
  },
  {
    zh: ['握距与肩同宽', '下放时手肘贴近身体', '杠铃下放到胸口下部'],
    en: ['Grip at shoulder width', 'Keep the elbows close as you lower', 'Touch the lower chest'],
  },
  {
    zh: ['杠铃放在上背，核心收紧', '坐下时膝盖顺着脚尖方向', '蹲到大腿至少与地面平行，脚跟不离地'],
    en: [
      'Set the bar on the upper back and brace',
      'Track the knees over the toes as you sit down',
      'Reach at least parallel with the heels down',
    ],
  },
  {
    zh: ['杠铃放在锁骨前，手肘抬高', '躯干保持直立', '膝盖向前，脚跟着地'],
    en: [
      'Rack the bar on the front of the shoulders with elbows high',
      'Keep the torso upright',
      'Let the knees travel forward with heels down',
    ],
  },
  {
    zh: ['脚放在踏板中部，与肩同宽', '下放到膝盖约 90 度', '不要锁死膝盖，腰不离开靠背'],
    en: [
      'Feet mid-platform at shoulder width',
      'Lower to about 90 degrees at the knee',
      'Do not lock the knees; keep the lower back on the pad',
    ],
  },
  {
    zh: ['背部贴紧靠垫', '下蹲到大腿与地面平行', '用脚掌整体发力推起'],
    en: ['Keep the back against the pad', 'Descend to parallel', 'Drive up through the whole foot'],
  },
  {
    zh: ['哑铃竖着抱在胸前', '躯干直立，手肘在膝盖内侧', '蹲到最低，脚跟着地'],
    en: [
      'Hold the dumbbell vertically against the chest',
      'Stay upright with elbows inside the knees',
      'Squat deep with heels down',
    ],
  },
  {
    zh: ['后脚放在凳上，前脚离凳约一大步', '身体垂直下降', '前膝顺着脚尖方向'],
    en: [
      'Rest the back foot on a bench about a stride behind',
      'Drop straight down',
      'Track the front knee over the toes',
    ],
  },
  {
    zh: ['步幅足够大，躯干直立', '后膝接近地面', '用前脚推回起始位置'],
    en: [
      'Take a long enough stride and stay upright',
      'Lower the back knee toward the floor',
      'Push back through the front foot',
    ],
  },
  {
    zh: ['调整靠背，让膝盖对准器械转轴', '伸直腿时在顶部停顿', '慢慢放下，不要借惯性'],
    en: [
      'Line the knees up with the machine pivot',
      'Pause at full extension',
      'Lower slowly without momentum',
    ],
  },
  {
    zh: ['膝盖微屈，屈髋把臀部向后推', '杠铃贴着大腿下滑，背部平直', '大腿后侧有明显拉伸后站起'],
    en: [
      'Soften the knees and push the hips back',
      'Slide the bar down the thighs with a flat back',
      'Stand up once the hamstrings are well stretched',
    ],
  },
  {
    zh: ['哑铃贴近腿部', '屈髋向后，背部平直', '臀部发力站起'],
    en: [
      'Keep the dumbbells close to the legs',
      'Hinge back with a flat back',
      'Drive the hips forward to stand',
    ],
  },
  {
    zh: ['膝盖对准器械转轴', '弯举到底部停顿', '髋部贴紧垫子'],
    en: [
      'Line the knees up with the pivot',
      'Pause at full contraction',
      'Keep the hips down on the pad',
    ],
  },
  {
    zh: ['膝盖对准器械转轴，大腿压紧', '弯举到底部停顿', '慢慢回放'],
    en: [
      'Line the knees up with the pivot and lock the thighs down',
      'Pause at full contraction',
      'Return slowly',
    ],
  },
  {
    zh: ['上背靠在凳边，杠铃放在髋部', '顶部时小腿垂直，身体成一直线', '下巴微收，臀部夹紧停顿'],
    en: [
      'Rest the upper back on the bench with the bar over the hips',
      'At the top, shins vertical and body in a straight line',
      'Tuck the chin and squeeze the glutes',
    ],
  },
  {
    zh: ['坐直，背部贴紧靠背', '向外打开到最大幅度', '慢慢回收，不要让配重片碰撞'],
    en: [
      'Sit tall with the back on the pad',
      'Push out to the end of the range',
      'Return slowly without letting the stack touch',
    ],
  },
  {
    zh: ['身体稍前倾，支撑腿微屈', '向后踢腿，用臀部发力', '腰不要塌，不要借力甩'],
    en: [
      'Lean forward slightly with a soft standing knee',
      'Kick back by squeezing the glute',
      'Do not arch the lower back or swing',
    ],
  },
  {
    zh: ['脚掌前部踩在踏板边缘', '脚跟充分下放，感受拉伸', '踮到最高停顿一秒'],
    en: [
      'Stand on the balls of the feet at the edge',
      'Drop the heels for a full stretch',
      'Rise high and hold for a second',
    ],
  },
  {
    zh: ['膝盖放在垫子下', '脚跟充分下放', '踮到最高停顿'],
    en: ['Set the knees under the pad', 'Drop the heels fully', 'Rise high and pause'],
  },
  {
    zh: ['悬挂时肩膀下沉，身体不要晃', '卷起骨盆把腿举高', '慢慢放下'],
    en: [
      'Hang with the shoulders set and the body still',
      'Curl the pelvis to lift the legs',
      'Lower slowly',
    ],
  },
  {
    zh: ['跪姿，把绳子放在头两侧', '用腹部卷曲身体，不要用手拉', '髋部保持不动'],
    en: [
      'Kneel with the rope beside the head',
      'Curl with the abs; do not pull with the arms',
      'Keep the hips still',
    ],
  },
  {
    zh: ['跪姿，核心收紧', '向前推到腰部快要下塌前', '用腹部把身体拉回来'],
    en: [
      'Start kneeling with the core braced',
      'Roll out until just before the lower back sags',
      'Pull back with the abs',
    ],
  },
  {
    zh: ['前臂放在凳上，手腕悬空', '只动手腕', '全程慢速控制'],
    en: [
      'Rest the forearms on a bench with the wrists off the edge',
      'Move only the wrists',
      'Keep the tempo slow',
    ],
  },
  {
    zh: [
      '屈髋把壶铃荡到两腿之间，背部平直',
      '用臀部快速发力向前送髋',
      '手臂只是放松地带动，壶铃到胸口高度',
    ],
    en: [
      'Hinge to swing the bell between the legs with a flat back',
      'Snap the hips forward with the glutes',
      'Let the arms stay loose; the bell floats to chest height',
    ],
  },
  {
    zh: ['凳子下斜 15–30 度，双脚勾住挡垫', '杠铃下放到胸部下缘', '肩胛骨全程后收贴紧凳面'],
    en: [
      'Set the bench to a 15–30 degree decline and hook the feet',
      'Lower the bar to the bottom of the chest',
      'Keep the shoulder blades pinned throughout',
    ],
  },
  {
    zh: ['先把哑铃放在大腿上再一起躺下', '哑铃下放到下胸两侧，手肘约 45 度', '推起时向中间靠拢'],
    en: [
      'Rest the dumbbells on the thighs before lying back',
      'Lower them beside the lower chest, elbows at about 45 degrees',
      'Press up and slightly in',
    ],
  },
  {
    zh: [
      '摆好凳子，让杠落在胸口中下部',
      '肩胛骨后收下沉，上背贴紧凳面',
      '起杠前先看好安全挂钩的位置',
    ],
    en: [
      'Place the bench so the bar meets the lower chest',
      'Pull the shoulder blades back and down into the bench',
      'Know where the safety hooks are before unracking',
    ],
  },
  {
    zh: ['凳子调到 30–45 度，杠落在锁骨下方', '肩胛骨保持收紧，不要耸肩', '轻触上胸后推起'],
    en: [
      'Set the bench to 30–45 degrees so the bar meets below the collarbones',
      'Keep the shoulder blades set; do not shrug',
      'Touch the upper chest lightly, then press',
    ],
  },
  {
    zh: ['调座椅让把手对准上胸', '背和头贴紧靠背', '推出时不要耸肩，回放时控制速度'],
    en: [
      'Set the seat so the handles line up with the upper chest',
      'Keep the back and head against the pad',
      'Press without shrugging; control the return',
    ],
  },
  {
    zh: ['凳子调到 30 度左右', '手肘微屈并保持不变，像抱大树', '下放到胸部有拉伸感即可，不要过低'],
    en: [
      'Set the bench to about 30 degrees',
      'Keep a fixed slight bend in the elbows, as if hugging a tree',
      'Lower until the chest stretches, not further',
    ],
  },
  {
    zh: ['滑轮放到最低，身体微前倾', '双手从下往上合拢到下巴高度', '手肘角度全程不变'],
    en: [
      'Set the pulleys low and lean slightly forward',
      'Sweep the hands up and together to chin height',
      'Keep the elbow angle fixed',
    ],
  },
  {
    zh: ['滑轮放到高位，前后脚站稳', '双手从上往下合拢到腹前', '合拢时稍停，夹紧胸部'],
    en: [
      'Set the pulleys high and stand in a split stance',
      'Bring the hands down and together in front of the hips',
      'Pause and squeeze at the end',
    ],
  },
  {
    zh: ['双脚放在凳上，手略宽于肩', '身体从头到脚保持一条直线', '下放到胸口接近地面'],
    en: [
      'Feet on a bench, hands slightly wider than the shoulders',
      'Keep a straight line from head to heels',
      'Lower until the chest nearly touches the floor',
    ],
  },
  {
    zh: [
      '上背横躺在凳上，双手托住一个哑铃',
      '手肘微屈，把哑铃沿弧线放到头后',
      '感到拉伸后把哑铃拉回胸口上方',
    ],
    en: [
      'Lie across a bench, holding one dumbbell over the chest',
      'With soft elbows, arc it back behind the head',
      'Pull it back over the chest once you feel the stretch',
    ],
  },
  {
    zh: ['凳子调到接近垂直，杠从下巴前方经过', '核心收紧，下背不要过度反弓', '推到手臂接近伸直'],
    en: [
      'Set the bench nearly upright so the bar passes in front of the chin',
      'Brace the core; do not over-arch the lower back',
      'Press until the arms are nearly straight',
    ],
  },
  {
    zh: ['调座椅让肩关节对准机器转轴', '用手肘外侧推动挡垫向上', '抬到与肩同高，慢慢放下'],
    en: [
      'Align the shoulder joint with the machine pivot',
      'Lead with the elbows against the pads',
      'Raise to shoulder height and lower slowly',
    ],
  },
  {
    zh: ['面向靠垫坐，把手与肩同高', '手臂微屈向后打开', '用后肩发力，不要耸肩'],
    en: [
      'Sit facing the pad with the handles at shoulder height',
      'Open the arms back with a slight bend',
      'Drive with the rear delts; do not shrug',
    ],
  },
  {
    zh: [
      '两侧滑轮调到肩高，左右手交叉握住拉索',
      '手臂微屈向两侧拉开',
      '回放时控制，不要让配重片相碰',
    ],
    en: [
      'Set both pulleys at shoulder height and cross the cables',
      'Pull the arms out to the sides with a slight bend',
      'Return under control without letting the stack touch',
    ],
  },
  {
    zh: ['握距略宽于肩，杠铃贴近身体', '用手肘带动向上拉', '拉到下胸即可，肩不舒服就降低高度'],
    en: [
      'Grip slightly wider than the shoulders and keep the bar close',
      'Lead with the elbows',
      'Stop at the lower chest; go lower if the shoulders complain',
    ],
  },
  {
    zh: ['双手握住杠铃片两侧', '手臂微屈抬到眼睛高度', '不要后仰借力'],
    en: [
      'Hold a plate at the sides with both hands',
      'Raise it to eye level with soft elbows',
      'Do not lean back to swing it',
    ],
  },
  {
    zh: ['杠铃一端固定，另一端握在肩前', '向前上方推出，核心收紧', '上身不要扭转'],
    en: [
      'Anchor one end of the bar and hold the other at the shoulder',
      'Press up and forward with the core braced',
      'Keep the torso from twisting',
    ],
  },
  {
    zh: ['臀部抬高，身体呈倒 V 字', '头向双手前方下放', '推起时臀部保持高位'],
    en: [
      'Raise the hips into an upside-down V',
      'Lower the head toward a point in front of the hands',
      'Press back up, keeping the hips high',
    ],
  },
  {
    zh: ['面向墙倒立，双手略宽于肩', '头下放到轻触地面或垫子', '收紧核心和臀部，避免塌腰'],
    en: [
      'Kick up against a wall with the hands slightly wider than the shoulders',
      'Lower the head to touch the floor or a mat',
      'Squeeze the core and glutes so the back does not sag',
    ],
  },
  {
    zh: ['杠铃架在肩前，膝盖微屈下沉', '腿快速蹬直，顺势把杠铃推起', '在头顶锁住，头稍向前'],
    en: [
      'Rack the bar on the shoulders and dip at the knees',
      'Drive through the legs and press the bar up',
      'Lock out overhead with the head slightly through',
    ],
  },
  {
    zh: ['壶铃放在肩前，手腕伸直', '向上推出时前臂保持垂直', '另一只手握拳，全身绷紧'],
    en: [
      'Rack the bell at the shoulder with a straight wrist',
      'Press up with the forearm vertical',
      'Make a fist with the free hand and stay tight',
    ],
  },
  {
    zh: ['反手握住单手把', '大臂贴紧身体不动', '下压到手臂伸直，慢慢回放'],
    en: [
      'Take a single handle with an underhand grip',
      'Pin the upper arm to the side',
      'Extend fully, then return slowly',
    ],
  },
  {
    zh: ['俯身让上身接近水平，大臂贴住身体', '只动小臂，向后伸直', '顶端停一下，夹紧三头'],
    en: [
      'Hinge until the torso is nearly flat, upper arm by the side',
      'Move only the forearm, extending it back',
      'Pause and squeeze at the top',
    ],
  },
  {
    zh: ['双手撑在凳边，手指朝前', '身体贴近凳子下放到大臂约水平', '肩膀不舒服就减小幅度'],
    en: [
      'Hands on the bench edge, fingers forward',
      'Lower close to the bench until the upper arms are about level',
      'Shorten the range if the shoulders complain',
    ],
  },
  {
    zh: ['双手在胸下拼成菱形', '手肘贴近身体向后弯', '身体保持一条直线'],
    en: [
      'Form a diamond with the hands under the chest',
      'Keep the elbows close as they bend back',
      'Hold a straight line from head to heels',
    ],
  },
  {
    zh: ['坐稳后握住两侧把手', '向下推到手臂伸直', '回放到大臂约水平，肩膀不要前顶'],
    en: [
      'Sit tall and take the side handles',
      'Press down until the arms are straight',
      'Return until the upper arms are about level, shoulders back',
    ],
  },
  {
    zh: ['大臂平放在垫上，手肘对准转轴', '只动小臂向下伸直', '回放时控制速度'],
    en: [
      'Rest the upper arms on the pad with the elbows at the pivot',
      'Extend using only the forearms',
      'Control the return',
    ],
  },
  {
    zh: ['仰卧，双手各握一个哑铃举在肩上方', '大臂不动，哑铃下放到头两侧', '用三头把哑铃伸直推回'],
    en: [
      'Lie back with the dumbbells over the shoulders',
      'Keep the upper arms still and lower the bells beside the head',
      'Extend back up with the triceps',
    ],
  },
  {
    zh: ['用 V 把或窄握把，大腿压紧挡垫', '身体稍后仰，把手柄拉到上胸', '回到顶端时让背部充分伸展'],
    en: [
      'Use a V-handle and lock the thighs under the pad',
      'Lean back slightly and pull to the upper chest',
      'Let the lats stretch fully at the top',
    ],
  },
  {
    zh: ['反手握杠，与肩同宽', '手肘向下贴近身体拉', '拉到锁骨下方，回放时控制'],
    en: [
      'Take an underhand, shoulder-width grip',
      'Drive the elbows down close to the body',
      'Pull to below the collarbones; control the return',
    ],
  },
  {
    zh: ['单手握把，身体稍向这一侧倾', '手肘向下向后拉到身侧', '回到顶端时让背部伸展'],
    en: [
      'Hold one handle and lean slightly to that side',
      'Drive the elbow down and back to the hip',
      'Let the lat stretch at the top',
    ],
  },
  {
    zh: ['调好座椅，大腿压紧挡垫', '手肘向下拉到身侧', '回放时慢，让背部伸展'],
    en: [
      'Set the seat and lock the thighs under the pad',
      'Drive the elbows down to the sides',
      'Return slowly into a full stretch',
    ],
  },
  {
    zh: ['胸贴靠垫，手臂向前上方伸直握把', '手肘向下向后拉', '拉到底时夹紧肩胛骨'],
    en: [
      'Chest on the pad, reaching up and forward to the handles',
      'Pull the elbows down and back',
      'Squeeze the shoulder blades at the end',
    ],
  },
  {
    zh: ['上身接近水平，每次从地面拉起', '把杠铃快速拉到下胸', '背部保持平直，每次放回地面'],
    en: [
      'Torso near parallel; start every rep from the floor',
      'Row the bar explosively to the lower chest',
      'Keep the back flat and return the bar to the floor',
    ],
  },
  {
    zh: ['屈髋俯身，背部平直', '两个哑铃一起拉向髋部', '顶端夹紧背部再慢放'],
    en: [
      'Hinge forward with a flat back',
      'Row both dumbbells toward the hips',
      'Squeeze at the top, then lower slowly',
    ],
  },
  {
    zh: ['上斜凳约 30 度，胸口贴住靠垫', '用手肘向后拉，不要用身体借力', '底部让手臂完全伸直'],
    en: [
      'Lie chest-down on a bench at about 30 degrees',
      'Row with the elbows; do not heave the torso',
      'Let the arms hang straight at the bottom',
    ],
  },
  {
    zh: ['单手握把，身体正对滑轮', '手肘贴身向后拉到腰侧', '回放时让肩向前伸展'],
    en: [
      'Hold one handle facing the pulley',
      'Pull the elbow back to the waist',
      'Let the shoulder reach forward on the return',
    ],
  },
  {
    zh: ['杠铃放在膝盖附近高度的保护杆上', '背部平直，髋部向前站直', '顶端站直即可，不要后仰'],
    en: [
      'Set the bar on the pins around knee height',
      'Keep the back flat and drive the hips through',
      'Stand tall at the top without leaning back',
    ],
  },
  {
    zh: ['杠放在腰高，身体在杠下伸直', '把胸口拉向杠', '身体保持一条直线，脚越远越难'],
    en: [
      'Hang under a waist-high bar with the body straight',
      'Pull the chest to the bar',
      'Stay in a straight line; walk the feet out to make it harder',
    ],
  },
  {
    zh: ['哑铃垂在身体两侧', '肩膀直上直下，不要绕圈', '顶端停一秒'],
    en: [
      'Hold the dumbbells at the sides',
      'Shrug straight up and down; do not roll',
      'Hold the top for a second',
    ],
  },
  {
    zh: ['调好座椅，靠垫在上背', '用下背和臀部向后伸展', '回到起点时慢，不要甩'],
    en: [
      'Set the seat with the pad on the upper back',
      'Extend back with the lower back and glutes',
      'Return slowly; do not swing',
    ],
  },
  {
    zh: ['握在曲杆的斜握位，手腕更舒服', '大臂贴住身体不动', '下放到手臂伸直'],
    en: [
      'Grip the angled part of the bar to ease the wrists',
      'Keep the upper arms pinned to the sides',
      'Lower until the arms are straight',
    ],
  },
  {
    zh: ['坐姿，大臂内侧靠住大腿', '只动小臂向上弯举', '顶端稍停，慢慢下放'],
    en: [
      'Sit and brace the upper arm against the inner thigh',
      'Curl with the forearm only',
      'Pause at the top and lower slowly',
    ],
  },
  {
    zh: ['腋下贴紧牧师凳上缘', '下放到手臂接近伸直', '底部不要放松弹起'],
    en: [
      'Tuck the armpit tight to the top of the pad',
      'Lower until the arm is nearly straight',
      'Do not bounce out of the bottom',
    ],
  },
  {
    zh: ['手肘对准机器转轴，大臂贴垫', '向上弯举到顶端夹紧', '慢慢放回到手臂伸直'],
    en: [
      'Align the elbows with the pivot, upper arms on the pad',
      'Curl up and squeeze at the top',
      'Lower slowly to straight arms',
    ],
  },
  {
    zh: ['用绳索把手，掌心相对', '大臂贴住身体向上弯举', '顶端把绳子向两侧稍分开'],
    en: [
      'Use the rope with the palms facing each other',
      'Curl with the upper arms by the sides',
      'Spread the rope slightly at the top',
    ],
  },
  {
    zh: ['胸口趴在上斜凳上，手臂垂直向下', '向上弯举，大臂不动', '顶端用力夹紧'],
    en: [
      'Lie chest-down on an incline bench, arms hanging straight',
      'Curl up without moving the upper arms',
      'Squeeze hard at the top',
    ],
  },
  {
    zh: ['背对低位滑轮，向前跨一步', '从手臂在身后伸直的位置开始', '大臂不动，向前弯举'],
    en: [
      'Face away from a low pulley and step forward',
      'Start with the arm stretched behind the body',
      'Curl forward without moving the upper arm',
    ],
  },
  {
    zh: ['正手握杠（掌心向下），与肩同宽', '大臂贴住身体向上弯举', '手腕保持伸直'],
    en: [
      'Take an overhand, shoulder-width grip',
      'Curl with the upper arms by the sides',
      'Keep the wrists straight',
    ],
  },
  {
    zh: ['前臂放在凳上，掌心向下', '只动手腕向上抬起', '慢慢放下'],
    en: [
      'Rest the forearms on a bench, palms down',
      'Raise the hands with the wrists only',
      'Lower slowly',
    ],
  },
  {
    zh: ['双脚站在杠的略前方，与肩同宽', '蹲到大腿至少与地面平行', '膝盖和脚尖方向一致'],
    en: [
      'Stand with the feet slightly ahead of the bar, shoulder-width',
      'Squat until the thighs are at least parallel',
      'Keep the knees tracking over the toes',
    ],
  },
  {
    zh: ['站在六角杠中间，握住两侧把手', '背部平直，腿和髋一起发力站起', '下放时沿原路线控制'],
    en: [
      'Stand in the centre and grip the side handles',
      'With a flat back, drive the legs and hips together',
      'Lower along the same path under control',
    ],
  },
  {
    zh: ['背贴靠垫，肩顶住肩垫', '尽量蹲深，膝盖可以超过脚尖', '起身到膝盖接近伸直即可'],
    en: [
      'Back against the pad, shoulders under the pads',
      'Sink as deep as you can; the knees may pass the toes',
      'Stop just short of locking the knees',
    ],
  },
  {
    zh: ['腰带系在髋部，站在平台上', '上身直立往下蹲', '用腿发力站起，背不用出力'],
    en: [
      'Strap the belt around the hips and stand on the platform',
      'Squat straight down with an upright torso',
      'Stand up with the legs; the back stays out of it',
    ],
  },
  {
    zh: ['每步向前跨出，后膝接近地面', '前脚整个脚掌发力站起', '上身保持直立'],
    en: [
      'Step forward until the back knee nearly touches the floor',
      'Drive up through the whole front foot',
      'Keep the torso upright',
    ],
  },
  {
    zh: ['箱子或凳子约膝盖高', '用前腿发力站上去，后脚不要蹬地', '下来时控制速度'],
    en: [
      'Use a box or bench about knee height',
      'Drive up with the front leg, not a push off the back foot',
      'Step down under control',
    ],
  },
  {
    zh: ['双脚与肩同宽，脚尖微朝外', '臀部向后下坐，胸口挺起', '蹲到大腿与地面平行后站起'],
    en: [
      'Feet shoulder-width, toes slightly out',
      'Sit the hips back and down with the chest up',
      'Reach parallel, then stand',
    ],
  },
  {
    zh: ['扶住固定物，脚跟抬起', '膝盖向前，膝到头保持一条直线向后倒', '用大腿前侧发力回到站立'],
    en: [
      'Hold a support and rise onto the toes',
      'Push the knees forward, leaning back in a line from knee to head',
      'Return with the quads',
    ],
  },
  {
    zh: ['站在箱前，摆臂起跳', '双脚同时轻落在箱上，膝盖微屈', '走下来，不要跳下'],
    en: [
      'Stand in front of the box and swing the arms to jump',
      'Land softly with both feet and bent knees',
      'Step down rather than jumping off',
    ],
  },
  {
    zh: ['膝盖几乎伸直，只微屈', '屈髋下放，杠贴近腿', '背部保持平直，腿后侧有拉伸感就起身'],
    en: [
      'Keep the knees almost straight',
      'Hinge at the hips with the bar close to the legs',
      'Keep the back flat; stand once the hamstrings stretch',
    ],
  },
  {
    zh: ['支撑腿膝盖微屈', '屈髋上身前倾，另一条腿向后抬', '髋部保持水平，不要翻转'],
    en: [
      'Keep a soft bend in the standing knee',
      'Hinge forward as the free leg reaches back',
      'Keep the hips square; do not let them open',
    ],
  },
  {
    zh: ['杠铃放在上背，膝盖微屈', '屈髋上身前倾到接近水平', '背部全程平直'],
    en: [
      'Bar on the upper back, knees soft',
      'Hinge until the torso is near parallel',
      'Keep the back flat throughout',
    ],
  },
  {
    zh: ['挡垫在脚跟上方', '单腿向上弯举，髋部贴住靠垫', '慢慢放下'],
    en: [
      'Set the pad just above the heel',
      'Curl one leg with the hips against the pad',
      'Lower slowly',
    ],
  },
  {
    zh: ['跪姿，脚跟被固定住', '膝到头保持一条直线，慢慢向前倒', '尽量控制下放，最后用手撑地推回'],
    en: [
      'Kneel with the heels anchored',
      'Lean forward slowly in a straight line from knee to head',
      'Resist as long as you can, then catch and push back',
    ],
  },
  {
    zh: [
      '双脚固定在 GHD 上，膝盖在垫子后方',
      '上身从水平开始，用腿后侧把身体拉起',
      '起身到身体竖直',
    ],
    en: [
      'Lock the feet in the GHD with the knees behind the pad',
      'From horizontal, curl the body up with the hamstrings',
      'Finish upright',
    ],
  },
  {
    zh: ['宽站距，脚尖朝外，双手在腿内侧握杠', '膝盖向外推，胸口挺起', '腿和髋一起发力站直'],
    en: [
      'Wide stance, toes out, hands inside the legs',
      'Push the knees out and keep the chest up',
      'Drive the legs and hips together to stand',
    ],
  },
  {
    zh: ['上背靠垫，挡带压在髋部', '用臀部向上推到身体呈直线', '顶端夹紧臀部停一秒'],
    en: [
      'Upper back on the pad, belt across the hips',
      'Drive up with the glutes until the body is straight',
      'Squeeze and hold for a second at the top',
    ],
  },
  {
    zh: ['上背靠凳，杠放在髋部并垫上护垫', '下巴微收，用臀部推起', '顶端小腿垂直于地面'],
    en: [
      'Upper back on a bench, padded bar over the hips',
      'Tuck the chin and drive up with the glutes',
      'Shins vertical at the top',
    ],
  },
  {
    zh: ['仰卧地面，杠铃放在髋部', '脚跟发力把髋推起', '顶端夹紧臀部，不要挺腰'],
    en: [
      'Lie on the floor with the bar over the hips',
      'Drive through the heels to lift the hips',
      'Squeeze the glutes at the top; do not arch the back',
    ],
  },
  {
    zh: ['胸贴靠垫，一只脚踩在踏板上', '用臀部把腿向后推', '顶端停一下，慢慢回放'],
    en: [
      'Chest on the pad, one foot on the plate',
      'Push the leg back with the glute',
      'Pause at the top and return slowly',
    ],
  },
  {
    zh: ['俯卧在台上，髋部在边缘', '双腿伸直向后抬到与身体成一直线', '控制下放，不要甩'],
    en: [
      'Lie face down with the hips at the edge',
      'Raise the straight legs until level with the body',
      'Lower under control without swinging',
    ],
  },
  {
    zh: ['前脚掌踩在踏板下缘', '腿伸直，只动脚踝', '底部充分拉伸，顶端停一秒'],
    en: [
      'Put the balls of the feet on the bottom edge of the plate',
      'Legs straight; move only at the ankles',
      'Stretch fully at the bottom and hold the top for a second',
    ],
  },
  {
    zh: ['单脚前掌踩在台阶上，同侧手拿哑铃', '脚跟下放到充分拉伸', '踮到最高停一秒'],
    en: [
      'Stand on one forefoot on a step, dumbbell in the same hand',
      'Drop the heel into a full stretch',
      'Rise as high as you can and hold for a second',
    ],
  },
  {
    zh: ['仰卧屈膝，手放在耳侧或胸前', '用腹部把肩胛骨卷离地面', '不要用手拉脖子'],
    en: [
      'Lie with the knees bent, hands by the ears or on the chest',
      'Curl the shoulder blades off the floor with the abs',
      'Do not pull on the neck',
    ],
  },
  {
    zh: ['仰卧屈膝，双脚踩稳', '从卷腹开始，一节一节坐起', '下放时慢，不要直接倒下'],
    en: [
      'Lie with the knees bent and feet planted',
      'Curl up one segment at a time',
      'Lower slowly instead of dropping back',
    ],
  },
  {
    zh: ['仰卧，双手放在臀下或身侧', '腿伸直抬到与地面垂直', '下放时下背贴地'],
    en: [
      'Lie flat, hands under the hips or at the sides',
      'Raise the straight legs to vertical',
      'Keep the lower back down as they lower',
    ],
  },
  {
    zh: ['悬挂在单杠上，身体不要晃', '屈膝把膝盖抬向胸口', '骨盆向上卷，慢慢放下'],
    en: [
      'Hang from the bar without swinging',
      'Bring the knees toward the chest',
      'Curl the pelvis up, then lower slowly',
    ],
  },
  {
    zh: ['前臂撑在扶手上，背贴靠垫', '把膝盖或伸直的腿抬到髋部高度', '不要摆动借力'],
    en: [
      'Forearms on the pads, back against the rest',
      'Raise the knees or straight legs to hip height',
      'Do not swing',
    ],
  },
  {
    zh: ['调好座椅，握住把手', '用腹部把身体向下卷', '不要用手臂拉'],
    en: [
      'Set the seat and take the handles',
      'Curl down with the abs',
      'Do not pull with the arms',
    ],
  },
  {
    zh: ['坐姿上身后倾，脚可以抬起', '双手（可拿重物）向两侧转动', '转的是上身，不只是手臂'],
    en: [
      'Sit and lean back, feet down or raised',
      'Rotate the hands from side to side, holding a weight if you like',
      'Turn the torso, not just the arms',
    ],
  },
  {
    zh: ['仰卧，手臂朝上，屈膝 90 度抬起', '对侧手脚同时慢慢伸出', '下背始终贴住地面'],
    en: [
      'Lie on your back, arms up, knees bent at 90 degrees',
      'Slowly extend the opposite arm and leg',
      'Keep the lower back on the floor',
    ],
  },
  {
    zh: ['侧对滑轮，双手把把手握在胸前', '向前推直，身体不要被拉转', '停两秒再收回'],
    en: [
      'Stand side-on to the pulley with the handle at the chest',
      'Press straight out without letting the cable turn you',
      'Hold for two seconds, then return',
    ],
  },
  {
    zh: ['滑轮放高位，侧身站稳', '双手斜向下拉过身体', '用躯干转动，手臂保持伸直'],
    en: [
      'Set the pulley high and stand side-on',
      'Pull diagonally down across the body',
      'Rotate through the torso with the arms straight',
    ],
  },
  {
    zh: ['杠铃从地面拉起，过膝后快速伸髋', '耸肩拉杠，身体钻到杠下', '用肩前接住杠，半蹲站稳'],
    en: [
      'Pull from the floor and extend the hips hard past the knees',
      'Shrug and pull yourself under the bar',
      'Catch it on the front of the shoulders in a quarter squat',
    ],
  },
  {
    zh: [
      '仰卧单手把壶铃举直，眼睛看着它',
      '分步起身：撑肘、撑手、抬髋、跪姿、站起',
      '手臂全程垂直，再按原步骤躺回',
    ],
    en: [
      'Lie down pressing the bell straight up, eyes on it',
      'Rise in steps: elbow, hand, hips, kneel, stand',
      'Keep the arm vertical and reverse the steps',
    ],
  },
  {
    zh: ['像摇摆一样屈髋发力', '壶铃贴近身体向上，手顺势穿过把手', '在头顶锁住，手臂伸直'],
    en: [
      'Hinge and drive as in a swing',
      'Keep the bell close and punch the hand through at the top',
      'Lock out overhead with a straight arm',
    ],
  },
  {
    zh: ['屈髋把壶铃上搏到肩前', '稳住后向上推出', '下放回肩前，再回到两腿之间'],
    en: [
      'Hinge and clean the bell to the rack position',
      'Settle, then press it overhead',
      'Lower to the rack, then back between the legs',
    ],
  },
  {
    zh: ['下蹲双手撑地，双脚向后跳成俯卧撑姿势', '做一个俯卧撑后收腿', '起身跳起，双手过头'],
    en: [
      'Squat, hands down, and jump the feet back to a plank',
      'Do a push-up, then jump the feet in',
      'Stand and jump with the hands overhead',
    ],
  },
  {
    zh: ['双手握弹力带，手臂在胸前伸直', '向两侧拉开到胸口', '夹紧肩胛骨，慢慢回放'],
    en: [
      'Hold the band at chest height with straight arms',
      'Pull it apart to the chest',
      'Squeeze the shoulder blades, then return slowly',
    ],
  },
  {
    zh: ['弹力带套在膝盖上方或脚踝', '半蹲姿势向侧面小步走', '膝盖保持向外，不要内扣'],
    en: [
      'Loop the band above the knees or at the ankles',
      'Step sideways in a half squat',
      'Keep the knees pushed out',
    ],
  },
  {
    zh: ['双脚踩住弹力带中间', '大臂贴住身体向上弯举', '下放时控制，不要被弹回'],
    en: [
      'Stand on the middle of the band',
      'Curl with the upper arms by the sides',
      'Control the way down instead of letting it snap back',
    ],
  },
  {
    zh: ['弹力带挂在高处', '大臂贴住身体，向下伸直', '慢慢回放'],
    en: ['Anchor the band overhead', 'Pin the upper arms and extend down', 'Return slowly'],
  },
]

// The cues of a built-in exercise; undefined for any other ID.
export function builtInExerciseCues(id: string): ExerciseCues | undefined {
  const index = BUILT_IN_EXERCISES.findIndex((exercise) => exercise.id === id)
  return index === -1 ? undefined : BUILT_IN_EXERCISE_CUES[index]
}
