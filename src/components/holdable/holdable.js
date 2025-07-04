/**
 * Holdable Component
 *
 * Overview: A component that allows an object to be picked up and held by a controller.
 *
 * Description: This component makes an object “holdable” by VR controllers using raycaster events targeted at objects with the “interactable” class. When the controller’s ray intersects the object, it listens for grip events. On grip down, the component saves any physics settings and re-parents the object to the controller, aligning it based on a local-custom position/rotation (from its schema) or a global default provided by a scene attribute (like `data-grab-position="0 0 0"`). Rotation pivots around the controller, not the model's center. It's easiest to set the custom rotation before position. If local-custom or global positions are not set, it defaults to where it was actually grabbed (local-computed). On grip up, it restores the original physics and parent. If the object has a `holdable-dynamic-body` attribute, it applies dynamic-body properties after release, even if the object was previously static.
 *
 * To Do: Add support for custom raycaster intersection classes, rather than using the “interactable” class.
 *
 * Notes:
 * - If using local-computed, using "0 0 0" for position or rotation will indicate no custom position or rotation. For rotation, this means the rotation will be the same as the object's original rotation when grabbed.
 *
 * Limitations:
 * - While there is some code in here showing support for the ammo.js driver, it is not working correctly. After release, collisions no longer work.
 * - There is no way to grab an object with both hands at the same time. User must let go of one hand before grabbing with the other.
 */
AFRAME.registerComponent("holdable", {
    schema: {
        position: { type: "vec3", default: { x: 0, y: 0, z: 0 } },
        rotation: { type: "vec3", default: { x: 0, y: 0, z: 0 } },
    },
    // dependencies: ['raycaster'], // This causes huge performance issues and is not needed at all, but good for benchmarking performance of models
    init: function () {
        this.isHeld = false;
        this.holdingHand = null;
        this.originalParent = this.el.parentElement;
        this.savedPhysics = []; // Save physics attributes (if any) on grab.
        this.savedSleepy = null; // Save sleepy component attributes (if any) on grab.
        this.sleepyTimerActive = false; // Flag: true when the sleepy timer is active.
        this.previousHandPosition = null; // For computing throw velocity.
        this.handVelocity = new THREE.Vector3();
        this.rayActive = false; // Flag: true when the raycaster is intersecting this object.
        this.insideMesh = {}; // Object to track if a either hand is inside the mesh.
        this.insideTestRaycaster = new THREE.Raycaster(); // Temporary raycaster for inside-mesh test.
        this.insideTestRaycaster.far = 10;
        this.onGripDown = this.onGripDown.bind(this);
        this.onGripUp = this.onGripUp.bind(this);
        this.onHitStart = this.onHitStart.bind(this);
        this.onHitEnd = this.onHitEnd.bind(this);
        this.el.addEventListener("raycaster-intersected", this.onHitStart);
        this.el.addEventListener("raycaster-intersected-cleared", this.onHitEnd);
        this.physicsDriver = this.el.sceneEl.getAttribute("physics");
        // If the "interactable" class is not already on the entity, add it
        if (!this.el.classList.contains("interactable")) {
            this.el.classList.add("interactable");
        }
    },
    tick: function (time, delta) {
        // If held, track the hand's world position to compute velocity.
        if (this.isHeld && this.holdingHand) {
            const currentPos = this.holdingHand.object3D.getWorldPosition(new THREE.Vector3());
            if (this.previousHandPosition) {
                // delta is in milliseconds; convert to seconds.
                const velocity = currentPos
                    .clone()
                    .sub(this.previousHandPosition)
                    .multiplyScalar(1000 / delta);
                this.handVelocity.copy(velocity);
            }
            this.previousHandPosition = currentPos.clone();
        }
    },
    onHitStart: function (evt) {
        // Find the controller (hand) by getting the closest parent with a controller component.
        const handEl = evt.detail.el.closest("[meta-touch-controls], [oculus-touch-controls], [hand-controls]");
        if (!handEl) return;
        if (this.isHeld) return;
        // Emit hit-start event with details
        this.el.emit("hit-start", {
            hand: handEl,
            entity: this.el,
        });
        this.rayActive = true;
        this.holdingHand = handEl;
        // Remove and event listeners to prevent multiple event listeners
        this.holdingHand.removeEventListener("gripdown", this.onGripDown);
        this.holdingHand.removeEventListener("gripup", this.onGripUp);
        // Add event listeners for grip events
        this.holdingHand.addEventListener("gripdown", this.onGripDown);
        this.holdingHand.addEventListener("gripup", this.onGripUp);
    },
    onHitEnd: function (evt) {
        const handEl = evt.detail.el.closest("[meta-touch-controls], [oculus-touch-controls], [hand-controls]");
        if (!handEl) return;
        // Emit hit-end event with details
        this.el.emit("hit-end", {
            hand: handEl,
            entity: this.el,
        });
        // Get a unique identifier for the hand; prefer the id attribute, or fallback to the object's uuid.
        const handId = handEl.getAttribute("id") || handEl.object3D.uuid;
        // Perform the inside-mesh test:
        const origin = handEl.object3D.getWorldPosition(new THREE.Vector3());
        const direction = new THREE.Vector3();
        handEl.object3D.getWorldDirection(direction);
        this.insideTestRaycaster.set(origin, direction.normalize());
        // Intersect the mesh (using recursive true in case the mesh is nested).
        const intersections = this.insideTestRaycaster.intersectObject(this.el.object3D, true);
        // Odd number of intersections implies the hand is inside.
        const isInside = intersections.length % 2 === 1;
        this.insideMesh[handId] = isInside;
        // If not inside mesh and the object is not held by this hand, remove event listeners.
        if (!this.insideMesh[handId] && !(this.isHeld && handEl === this.holdingHand)) {
            handEl.removeEventListener("gripdown", this.onGripDown);
            handEl.removeEventListener("gripup", this.onGripUp);
        }
        this.rayActive = false;
    },
    onGripDown: function (evt) {
        const hasHoldableDynamicBody = this.el.hasAttribute("holdable-dynamic-body");
        const hasShapeComponents = Object.keys(this.el.components).some((key) => key.includes("shape__"));
        if (this.isHeld) return;
        const handEl = evt.target.closest("[meta-touch-controls], [oculus-touch-controls], [hand-controls]");
        if (!handEl) return;
        // Emit grip-down event with details
        this.el.emit("grip-down", {
            hand: handEl,
            entity: this.el,
        });
        this.holdingHand = handEl;
        // Save physics attributes if they exist.
        if (this.el.hasAttribute("dynamic-body")) {
            this.savedPhysics = [
                {
                    type: "dynamic-body",
                    config: this.el.getAttribute("dynamic-body"),
                },
            ];
            this.el.removeAttribute("dynamic-body");
        } else if (this.el.hasAttribute("ammo-body")) {
            this.savedPhysics = [
                {
                    type: "ammo-body",
                    config: this.el.getAttribute("ammo-body"),
                },
            ];
            this.el.removeAttribute("ammo-body");
        } else if (this.el.hasAttribute("body") || (hasHoldableDynamicBody && hasShapeComponents)) {
            // Custom collision shapes (Cannon.js)
            // Save the body component properties
            const bodyAttributes = this.el.getAttribute("body");
            const bodyType = hasHoldableDynamicBody && hasShapeComponents ? "dynamic" : bodyAttributes ? bodyAttributes.type : "dynamic";
            const bodyShape = bodyAttributes ? bodyAttributes.shape : "auto";
            const bodyMass = bodyAttributes ? bodyAttributes.mass : 5;
            const bodyLinearDamping = bodyAttributes ? bodyAttributes.linearDamping : "0.01";
            const bodyAngularDamping = bodyAttributes ? bodyAttributes.angularDamping : "0.01";
            const bodySphereRadius = bodyAttributes ? bodyAttributes.sphereRadius : "";
            const bodyCylinderAxis = bodyAttributes ? bodyAttributes.cylinderAxis : "";
            this.savedPhysics = [];
            // Only save and restore the body component if it is dynamic
            // Note: Not sure why, but in my testing, the dynamic body only restored correctly when I did this, but the static body did not restore correctly when I tried to save and restore it.
            if (bodyType === "dynamic") {
                this.savedPhysics = [
                    {
                        type: "body",
                        config: { type: bodyType, shape: bodyShape, mass: bodyMass, linearDamping: bodyLinearDamping, angularDamping: bodyAngularDamping, sphereRadius: bodySphereRadius, cylinderAxis: bodyCylinderAxis },
                    },
                ];
                this.el.removeAttribute("body");
            }
            // For each shape__* component, save the properties
            const shapeComponents = this.el.components;
            for (const key in shapeComponents) {
                if (key.includes("shape__")) {
                    // Increment the shape name by 100
                    // Note: I tried to use a timestamp, but for some reason it duplicated shapes exponentially. Incrementing by 100 seems to work linearly though.
                    let shapeName = key;
                    if (!shapeName.match(/\d+$/)) {
                        shapeName += "100"; // Add a number to the end if it doesn't exist yet
                    } else {
                        const num = parseInt(shapeName.match(/\d+$/)[0]);
                        shapeName = shapeName.replace(/\d+$/, num + 100); // Increment the number
                    }
                    // Save the properties and push them to the savedPhysics array
                    const shape = this.el.getAttribute(key).shape;
                    const offset = this.el.getAttribute(key).offset;
                    const orientation = this.el.getAttribute(key).orientation;
                    const radius = this.el.getAttribute(key).radius;
                    const halfExtents = this.el.getAttribute(key).halfExtents;
                    const radiusTop = this.el.getAttribute(key).radiusTop;
                    const radiusBottom = this.el.getAttribute(key).radiusBottom;
                    const height = this.el.getAttribute(key).height;
                    const numSegments = this.el.getAttribute(key).numSegments;
                    this.savedPhysics.push({
                        type: shapeName,
                        config: { shape: shape, offset: offset, orientation: orientation, radius: radius, halfExtents: halfExtents, radiusTop: radiusTop, radiusBottom: radiusBottom, height: height, numSegments: numSegments },
                    });
                }
            }
            // If the sleepy component is present, save and remove it
            // Note: This is because for some reason, having multiple custom collision shapes causes the object to almost immediately fall asleep on release, even if the speed is fast. Removing it and adding it back seems to fix the issue. Not an issue when using the dynamic-body component.
            if (this.el.hasAttribute("sleepy")) {
                this.savedSleepy = this.el.getAttribute("sleepy");
                this.el.removeAttribute("sleepy");
            }
        }
        this.isHeld = true;
        // Reset hand velocity tracking.
        this.previousHandPosition = this.holdingHand.object3D.getWorldPosition(new THREE.Vector3());
        this.handVelocity.set(0, 0, 0);
        const handObj = this.holdingHand.object3D;
        // Determine which hand is holding the object.
        const handData = this.holdingHand.getAttribute("meta-touch-controls") || this.holdingHand.getAttribute("oculus-touch-controls") || this.holdingHand.getAttribute("hand-controls") || {};
        const handType = handData.hand || "right";
        // Ensure matrices are up-to-date.
        handObj.updateMatrixWorld(true);
        this.el.object3D.updateMatrixWorld(true);
        // Compute the local-computed transform relative to the hand.
        const worldMatrix = this.el.object3D.matrixWorld.clone();
        const handInverse = new THREE.Matrix4().copy(handObj.matrixWorld).invert();
        const localMatrix = new THREE.Matrix4().multiplyMatrices(handInverse, worldMatrix);
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        localMatrix.decompose(pos, quat, scale);
        // Determine the grab position offset.
        let customGrabPos;
        // Determine if a local-custom grab position has been provided.
        let useCustomPos = false;
        let isGlobalDefault = false;
        if (this.data.position.x !== 0 || this.data.position.y !== 0 || this.data.position.z !== 0) {
            customGrabPos = new THREE.Vector3(this.data.position.x, this.data.position.y, this.data.position.z);
            customGrabPos.x = handType === "left" ? -customGrabPos.x : customGrabPos.x;
            useCustomPos = true;
        } else {
            // Check for a global default on the a-scene.
            const sceneGrabPosAttr = this.el.sceneEl.getAttribute("data-grab-position");
            if (sceneGrabPosAttr) {
                customGrabPos = new THREE.Vector3().copy(AFRAME.utils.coordinates.parse(sceneGrabPosAttr));
                customGrabPos.x = handType === "left" ? -customGrabPos.x : customGrabPos.x;
                useCustomPos = true;
                isGlobalDefault = true;
            } else {
                // Fall back to the computed position.
                customGrabPos = pos;
                useCustomPos = false;
            }
        }
        // Determine the grab rotation.
        let customGrabQuat;
        if (this.data.rotation.x !== 0 || this.data.rotation.y !== 0 || this.data.rotation.z !== 0) {
            // Adjust rotation based on hand
            let customGrabRotationY = handType === "left" ? -this.data.rotation.y : this.data.rotation.y;
            let customGrabRotationZ = handType === "left" ? -this.data.rotation.z : this.data.rotation.z;
            const euler = new THREE.Euler(THREE.MathUtils.degToRad(this.data.rotation.x), THREE.MathUtils.degToRad(customGrabRotationY), THREE.MathUtils.degToRad(customGrabRotationZ));
            customGrabQuat = new THREE.Quaternion().setFromEuler(euler);
        } else {
            customGrabQuat = quat; // Use the object's current rotation.
        }
        // Compute the final position.
        let finalPos;
        if (useCustomPos) {
            // If using a local-custom or global position, adjust it relative to the bottom corner.
            let size;
            if (!isGlobalDefault) {
                // For local custom position, compute bounding box using the specified rotation.
                const tempObj = this.el.object3D.clone();
                tempObj.quaternion.copy(customGrabQuat);
                tempObj.updateMatrixWorld(true);
                const bbox = new THREE.Box3().setFromObject(tempObj);
                size = bbox.getSize(new THREE.Vector3());
            } else {
                // For global default position, use the object's current rotation.
                const bbox = new THREE.Box3().setFromObject(this.el.object3D);
                size = bbox.getSize(new THREE.Vector3());
            }
            const bottomCornerOffset = new THREE.Vector3();
            if (handType === "left") {
                bottomCornerOffset.set(-size.x / 2, -size.y / 2, size.z / 2);
            } else {
                bottomCornerOffset.set(size.x / 2, -size.y / 2, size.z / 2);
            }
            // Adjust the custom grab position relative to the bottom corner.
            finalPos = customGrabPos.clone().sub(bottomCornerOffset);
        } else {
            // Otherwise (if using local-computed pos), use the computed pos directly.
            finalPos = pos;
        }
        // Reparent the object to the hand.
        handObj.attach(this.el.object3D);
        // Set the final position and rotation.
        this.el.object3D.position.copy(finalPos);
        this.el.object3D.quaternion.copy(customGrabQuat);
        this.el.object3D.updateMatrixWorld(true);
    },
    onGripUp: function (evt) {
        if (!this.isHeld || !this.holdingHand) return;
        // Emit grip-up event with details
        this.el.emit("grip-up", {
            hand: this.holdingHand,
            entity: this.el,
        });
        this.el.object3D.updateMatrixWorld(true);
        // Reparent back to the original parent.
        this.originalParent.object3D.attach(this.el.object3D);
        this.el.object3D.updateMatrixWorld(true);
        // Restore the original physics attributes if they were saved.
        if (this.savedPhysics) {
            this.savedPhysics.forEach((saved) => {
                this.el.setAttribute(saved.type, saved.config);
            });
            this.savedPhysics = null;
        }
        // Restore the sleepy component if it was saved.
        if (this.savedSleepy) {
            // Add the sleepy component back
            if (this.sleepyTimerId) {
                // The sleepy timer is already active. Clear it to essentially restart the timer.
                clearTimeout(this.sleepyTimerId);
            } else {
                // Set the flag to true to indicate the timer has been started.
                this.sleepyTimerActive = true;
            }
            this.sleepyTimerId = setTimeout(() => {
                this.el.setAttribute("sleepy", `allowSleep: true; speedLimit: ${this.savedSleepy.speedLimit}; delay: ${this.savedSleepy.delay}; angularDamping: ${this.savedSleepy.angularDamping}; linearDamping: ${this.savedSleepy.linearDamping}; holdState: ${this.savedSleepy.holdState};`);
                this.savedSleepy = null;
                this.sleepyTimerActive = false;
                this.sleepyTimerId = null;
            }, 4000);
            // We wait a few seconds after release to give the object time to land before adding the sleepy component back. It would be better to detect when the object is no longer moving very much, but this is a simple solution for now.
        }
        // If object has "holdable-dynamic-body" attribute but no "body" attribute, then add the dynamic-body component with properties within the attribute.
        if (this.el.hasAttribute("holdable-dynamic-body") && !this.el.hasAttribute("body")) {
            // Remove static-body component if it exists
            if (this.el.hasAttribute("static-body")) {
                this.el.removeAttribute("static-body");
            }
            const dynamicBodyData = this.el.getAttribute("holdable-dynamic-body");
            this.el.setAttribute("dynamic-body", dynamicBodyData);
        }
        this.isHeld = false;
        // Apply throw velocity if a physics body exists. Wait a tick to let the physics system initialize the body.
        setTimeout(() => {
            if (this.el.body && this.handVelocity) {
                // Calculate modified throw velocity: 50% increase in speed plus additional upward arc.
                let throwVelocity = this.handVelocity.clone().multiplyScalar(1.5); // Increase speed by 50%.
                throwVelocity.y += 1; // Add a slight upward arc. (1 meter per second)
                // If driver is cannon
                if (this.physicsDriver.driver === "local") {
                    this.el.body.velocity.set(throwVelocity.x, throwVelocity.y, throwVelocity.z);
                } else if (this.physicsDriver.driver === "ammo") {
                    this.el.body.setLinearVelocity(new Ammo.btVector3(throwVelocity.x, throwVelocity.y, throwVelocity.z));
                }
            }
        }, 50);
        // Simulate pulling the raycaster away by temporarily setting the raycaster's far value to 0, then restoring it. This lets the user grab the object again without moving the controller away first.
        const handEls = document.querySelectorAll("[meta-touch-controls], [oculus-touch-controls], [hand-controls]");
        if (handEls) {
            handEls.forEach((handEl) => {
                // Check if the hand is left or right
                const handData = handEl.getAttribute("meta-touch-controls") || handEl.getAttribute("oculus-touch-controls") || handEl.getAttribute("hand-controls") || {};
                const handType = handData.hand || "right";
                if (!handType) return;
                const rayEl = handEl.querySelector("[raycaster]");
                const rayData = rayEl?.getAttribute("raycaster");
                if (rayData && typeof rayData.far === "number") {
                    // Check if already in the process of modifying the far value in case multiple objects are grabbed and released at once.
                    if (rayEl.getAttribute(`data-tempFar-active-${handType}`)) {
                        // If already active, skip modifying.
                    } else {
                        rayEl.setAttribute(`data-tempFar-active-${handType}`, "true");
                        const originalFar = rayData.far;
                        rayEl.setAttribute("raycaster", "far: 0");
                        setTimeout(() => {
                            rayEl.setAttribute("raycaster", `far: ${originalFar}`);
                            rayEl.removeAttribute(`data-tempFar-active-${handType}`);
                        }, 50);
                    }
                }
            });
        }
        // Check if the hand is still inside the object's bbox. If so, don't remove the event listeners quite yet in case the user wants to grab it again right away and the raycaster is fully inside the mesh.
        const handPos = this.holdingHand.object3D.getWorldPosition(new THREE.Vector3());
        const bbox = new THREE.Box3().setFromObject(this.el.object3D);
        if (!bbox.containsPoint(handPos)) {
            this.holdingHand.removeEventListener("gripdown", this.onGripDown);
            this.holdingHand.removeEventListener("gripup", this.onGripUp);
            this.holdingHand = null;
        }
    },
    remove: function () {
        this.el.removeEventListener("raycaster-intersected", this.onHitStart);
        this.el.removeEventListener("raycaster-intersected-cleared", this.onHitEnd);
        if (this.holdingHand) {
            this.holdingHand.removeEventListener("gripdown", this.onGripDown);
            this.holdingHand.removeEventListener("gripup", this.onGripUp);
        }
    },
});
