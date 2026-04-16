/**
 * ==================== Rendering State Machine ====================
 *
 * Global states:
 *
 * 1. Idle
 *    - No scaling, no rendering
 *
 * 2. Scaling (wheel active)
 *    - canvasScaleRatio changes
 *    - NO pdf render
 *
 * 3. Settling (wheel stopped)
 *    - setScale triggered
 *    - render tasks scheduled
 *
 * 4. Rendering
 *    - pdf.js rendering pages
 *    - can be interrupted by new scaling
 *
 * 5. Scrolling
 *    - Handled by React.
 *
 * Transitions:
 *
 * Idle → Scaling            (wheel start)
 * Scaling → Settling        (wheel idle timeout)
 * Settling → Rendering      (setScale)
 * Rendering → Scaling       (new wheel event → cancel tasks)
 * Rendering → Idle          (all tasks done)
 *
 */
