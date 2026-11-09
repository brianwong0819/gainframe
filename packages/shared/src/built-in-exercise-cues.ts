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
]

// The cues of a built-in exercise; undefined for any other ID.
export function builtInExerciseCues(id: string): ExerciseCues | undefined {
  const index = BUILT_IN_EXERCISES.findIndex((exercise) => exercise.id === id)
  return index === -1 ? undefined : BUILT_IN_EXERCISE_CUES[index]
}
