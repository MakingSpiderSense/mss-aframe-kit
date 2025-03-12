import { triggerHaptics } from '../_helpers/helpers.js'

// Raycaster Intersections
AFRAME.registerComponent('raycaster-listener', {
    init: function () {
        console.log('Raycaster Listener initialized');
        const el = this.el;
        const originalColor = "#ffffff";
        const styledRay = document.querySelectorAll('.styled-ray');
        const reticle = document.querySelector('#reticle');
        // Make reticle larger and beam color green when intersecting
        el.addEventListener('raycaster-intersected', function (evt) {
            styledRay.forEach(function (ray) {
                ray.setAttribute('material', 'color', '#A2F5A2');
            });
            if (reticle) {
                reticle.setAttribute('geometry', 'radius', '.008');
            }
            // Find the controller that caused the intersection
            const handEl = evt.detail.el.closest('[meta-touch-controls], [oculus-touch-controls], [hand-controls]');
            if (handEl) {
                // Get the hand type from the controller component
                const handData = handEl.getAttribute('meta-touch-controls') || handEl.getAttribute('oculus-touch-controls') || handEl.getAttribute('hand-controls') || {};
                const handType = handData.hand || 'right';
                // Trigger haptics on the appropriate hand
                triggerHaptics(handType, 150, 0.1);
            }
        });
        el.addEventListener('raycaster-intersected-cleared', function () {
            styledRay.forEach(function (ray) {
                ray.setAttribute('material', 'color', originalColor);
            });
            if (reticle) {
                reticle.setAttribute('geometry', 'radius', '.005');
            }
        });
    }
});