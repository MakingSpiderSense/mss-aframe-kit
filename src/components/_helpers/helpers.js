// Utility function to trigger haptics
export function triggerHaptics(hand, duration, force) {
    // console.log(`Triggering haptics: hand=${hand}, duration=${duration}, force=${force}`);
    const leftHand = document.querySelector('#left-hand');
    const rightHand = document.querySelector('#right-hand');
    if (hand === 'left') {
        initVibration(leftHand, duration, force);
    } else if (hand === 'right') {
        initVibration(rightHand, duration, force);
    } else if (hand === 'both') {
        initVibration(leftHand, duration, force);
        initVibration(rightHand, duration, force);
    }
}
// Utility function to trigger haptic patterns
export function triggerHapticPattern(hand, pattern) {
    const leftHand = document.querySelector('#left-hand');
    const rightHand = document.querySelector('#right-hand');
    let totalDuration = 0;
    pattern.forEach((step) => {
        setTimeout(() => {
            console.log(`Vibrating ${hand} hand for ${step.duration}ms with intensity ${step.intensity}`);
            if (hand === 'left') {
                initVibration(leftHand, step.duration, step.intensity);
            } else if (hand === 'right') {
                initVibration(rightHand, step.duration, step.intensity);
            } else if (hand === 'both') {
                initVibration(leftHand, step.duration, step.intensity);
                initVibration(rightHand, step.duration, step.intensity);
            }
        }, totalDuration);
        totalDuration += step.duration;
    });
}
// Initialize the vibration
// Note: There are still issues if two haptic triggers over 5 seconds are called in quick succession. Not a big deal right now, but could be improved.
export function initVibration(hand, duration, force) {
    // Since the vibration is limited to 5 seconds, we need to break it up into smaller chunks if it exceeds that duration
    const maxDuration = 5000;
    if (duration <= maxDuration) {
        hand.setAttribute('haptics__trigger', `dur: ${duration}; force: ${force}`);
        hand.emit('trigger-vibration');
    } else {
        // We need to break up the vibration into smaller chunks
        let remainingDuration = duration;
        function vibrate() {
            if (remainingDuration > maxDuration) {
                hand.setAttribute('haptics__trigger', `dur: ${maxDuration}; force: ${force}`);
                hand.emit('trigger-vibration');
                remainingDuration -= maxDuration;
                // Keep calling vibrate until the remaining duration is less than the max duration
                setTimeout(vibrate, maxDuration);
            } else {
                // Vibrate for the remaining duration
                hand.setAttribute('haptics__trigger', `dur: ${remainingDuration}; force: ${force}`);
                hand.emit('trigger-vibration');
            }
        }
        vibrate();
    }
}