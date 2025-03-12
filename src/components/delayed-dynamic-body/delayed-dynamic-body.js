/**
 * Adds a dynamic-body component to the element after a specified delay.
 */
AFRAME.registerComponent('delayed-dynamic-body', {
    schema: {
        delay: { type: 'number', default: 2000 } // delay in milliseconds
    },
    init: function() {
        const sceneEl = this.el.sceneEl;
        const addBody = () => {
            setTimeout(() => {
                this.el.setAttribute('dynamic-body', '');
            }, this.data.delay);
        };
        if (sceneEl.hasLoaded) {
            addBody();
        } else {
            sceneEl.addEventListener('loaded', addBody);
        }
    }
});