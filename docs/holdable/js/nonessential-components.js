/**
 * This file contains non-essential components for the holdable example with the focus on user experience enhancements. There is no need to use these components.
 */


// Face user on grip release
// Description: On grip release, smoothly rotate the entity so that its Y rotation faces the `.user` entity.
AFRAME.registerComponent('face-user-on-release', {
    init: function () {
        const el = this.el;
        el.addEventListener('grip-up', () => {
            const userEl = document.querySelector('.user');
            if (!userEl) {
                console.warn('No .user entity found in scene.');
                return;
            }
            // Get positions
            const elPos = el.object3D.position;
            const userPos = userEl.object3D.position;
            // Calculate direction vector from el to user
            const dx = userPos.x - elPos.x;
            const dz = userPos.z - elPos.z;
            // Y rotation in degrees, facing the user
            const targetY = THREE.MathUtils.radToDeg(Math.atan2(dx, dz));
            el.setAttribute('animation__faceuser', {
                property: 'rotation',
                to: `0 ${targetY} 0`,
                dur: 1000,
                easing: 'easeInOutQuad'
            });
        });
    }
});

// Info Board - Used to describe holdable objects
AFRAME.registerComponent('info-board', {
    schema: {
        title: { type: 'string', default: 'Add Title Here' },
        details: { type: 'string', default: '- Point 1\n- Point 2' },
        panelHeight: { type: 'number', default: 0.75 },
        fadeDistance: { type: 'number', default: 2.5 }, // Distance threshold (XZ only)
        fadeDuration: { type: 'number', default: 600 }  // Fade animation duration in ms
    },
    init: function () {
        const el = this.el;
        const data = this.data;
        // Create the background plane
        const plane = document.createElement('a-plane');
        plane.setAttribute('color', '#ffffff');
        plane.setAttribute('height', data.panelHeight);
        plane.setAttribute('width', '1');
        plane.setAttribute('opacity', '0');
        plane.setAttribute('material', 'side: double');
        el.appendChild(plane);
        // Heading
        const title = document.createElement('a-text');
        const titlePosY = data.panelHeight / 2 - 0.045; // Adjust title Y position based on panel height
        title.setAttribute('value', data.title);
        title.setAttribute('color', '#222');
        title.setAttribute('width', '1.7');
        title.setAttribute('position', `-0.43 ${titlePosY} 0.01`);
        title.setAttribute('anchor', 'left');
        title.setAttribute('baseline', 'top');
        title.setAttribute('font', 'assets/fonts/mozillavr.fnt');
        title.setAttribute('opacity', '0');
        el.appendChild(title);
        // Body text
        const bodyText = document.createElement('a-text');
        const bodyPosY = titlePosY - 0.15; // Position body text below title
        bodyText.setAttribute('value', data.details);
        bodyText.setAttribute('color', '#222');
        bodyText.setAttribute('width', '1.5');
        bodyText.setAttribute('position', `-0.43 ${bodyPosY} 0.01`);
        bodyText.setAttribute('anchor', 'left');
        bodyText.setAttribute('baseline', 'top');
        bodyText.setAttribute('line-height', '113');
        bodyText.setAttribute('font', 'assets/fonts/mozillavr.fnt');
        bodyText.setAttribute('opacity', '0');
        el.appendChild(bodyText);
        // Store references
        this.plane = plane;
        this.title = title;
        this.bodyText = bodyText;
        // Fade state tracking
        this.isVisible = false;
        // Cache reference to user rig
        this.userRig = document.querySelector('.user');
        if (!this.userRig) {
            console.warn('[info-board] No element with class "user" found in scene.');
        }
    },
    tick: function () {
        if (!this.userRig) return;
        const userPos = this.userRig.object3D.position;
        const boardPos = this.el.object3D.position;
        // Calculate XZ distance only
        const dx = userPos.x - boardPos.x;
        const dz = userPos.z - boardPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        // If within range and not visible, fade in
        if (distance <= this.data.fadeDistance && !this.isVisible) {
            this.isVisible = true;
            this.fadeToOpacity(0.9);
        }
        // If out of range and currently visible, fade out
        else if (distance > this.data.fadeDistance && this.isVisible) {
            this.isVisible = false;
            this.fadeToOpacity(0);
        }
    },
    fadeToOpacity: function (targetOpacity) {
        const duration = this.data.fadeDuration;
        // Plane fade
        this.plane.setAttribute('animation__plane', {
            property: 'material.opacity',
            to: targetOpacity,
            dur: duration,
            easing: 'easeInOutQuad'
        });
        // Title fade
        this.title.setAttribute('animation__title', {
            property: 'opacity',
            to: targetOpacity,
            dur: duration,
            easing: 'easeInOutQuad'
        });
        // Body text fade
        this.bodyText.setAttribute('animation__body', {
            property: 'opacity',
            to: targetOpacity,
            dur: duration,
            easing: 'easeInOutQuad'
        });
    }
});