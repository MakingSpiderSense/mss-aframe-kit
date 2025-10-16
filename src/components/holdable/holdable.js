/**
 * Holdable Component
 *
 * Overview: A component that allows an object to be picked up and held by a controller.
 *
 * Description: This component makes an object "holdable" by VR controllers using raycaster events targeted at objects with the specified intersection class (defaults to "interactable"). When the controller's ray intersects the object, it listens for grip events. On grip down, the component saves any physics settings and re-parents the object to the controller, optionally aligning it based on a local-custom position/rotation (from its schema) or a global default provided by a scene attribute (like `data-holdable-grab-position="0 0 0"`). On grip up, it restores the original physics and parent.
 *
 * More info: https://github.com/MakingSpiderSense/mss-aframe-kit/tree/main/docs/holdable
 */
AFRAME.registerComponent("holdable", {
    schema: {
        position: { type: "vec3", default: { x: 0, y: 0, z: 0 } },
        rotation: { type: "vec3", default: { x: 0, y: 0, z: 0 } },
        leftHandRotationInvert: { type: "array", default: ["y", "z"] }, // Pick the rotation axes to invert for left hand (if using local-custom rotation)
        insideMeshDetection: { type: "boolean", default: true }, // Enable/disable inside-mesh raycast detection
        debug: { type: "boolean", default: false }, // Show debug logs in console (helpful for getting grab position/rotation)
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
        this.insideTestRaycaster.far = 10; // 10 meters
        this.savedComponentStates = {}; // Modifiers - Store original component states
        this.gripModifiers = {}; // Modifiers - Store grip modifiers
        this.releaseModifiers = {}; // Modifiers - Store release modifiers
        this.scanModifierAttributes(); // Modifiers - Scan for grip and release modifiers
        this.onGripDown = this.onGripDown.bind(this);
        this.onGripUp = this.onGripUp.bind(this);
        this.onHitStart = this.onHitStart.bind(this);
        this.onHitEnd = this.onHitEnd.bind(this);
        this.el.addEventListener("raycaster-intersected", this.onHitStart);
        this.el.addEventListener("raycaster-intersected-cleared", this.onHitEnd);
        this.physicsDriver = this.el.sceneEl.getAttribute("physics");
        // Determine which intersection class to use from scene attribute, or use default
        let intersectionClass = "interactable"; // Default
        const sceneIntersectionClass = this.el.sceneEl.getAttribute("data-holdable-intersection-class");
        if (sceneIntersectionClass) {
            intersectionClass = sceneIntersectionClass;
        }
        // If the specified intersection class is not already on the entity, add it
        if (!this.el.classList.contains(intersectionClass)) {
            this.el.classList.add(intersectionClass);
        }
        // Ensure the model's materials are double-sided to prevent issues with inside-mesh raycasting
        if (this.data.insideMeshDetection) {
            const makeDoubleSided = (mesh) => {
                if (!mesh) return;
                mesh.traverse((node) => {
                    if (node.isMesh && node.material) {
                        node.material.side = THREE.DoubleSide;
                        node.material.needsUpdate = true;
                    }
                });
            };
            // If mesh was loaded right away (usually primitives and simple models)
            const initialMesh = this.el.getObject3D("mesh");
            if (initialMesh) {
                makeDoubleSided(initialMesh);
            }
            // If model is loaded later (e.g. glTF models), listen for model-loaded event
            this.el.addEventListener("model-loaded", () => {
                makeDoubleSided(this.el.getObject3D("mesh"));
            });
        }
    },
    // Modifiers - Scan for grip and release modifier attributes
    scanModifierAttributes: function () {
        const attributes = this.el.getAttributeNames();
        for (let attr of attributes) {
            // Check for grip modifiers (holdable-grip-componentName)
            if (attr.startsWith("holdable-grip-")) {
                const componentName = attr.substring("holdable-grip-".length); // Remove the prefix
                const attributeString = this.el.getAttribute(attr);
                // Parse the string into an object
                const parsedProps = this.parseAttributeString(attributeString);
                this.gripModifiers[componentName] = parsedProps;
            }
            // Check for release modifiers (holdable-release-componentName)
            else if (attr.startsWith("holdable-release-")) {
                const componentName = attr.substring("holdable-release-".length); // Remove the prefix
                const attributeString = this.el.getAttribute(attr);
                // Parse the string into an object
                const parsedProps = this.parseAttributeString(attributeString);
                this.releaseModifiers[componentName] = parsedProps;
            }
        }
    },
    // Modifiers - Parse an A-Frame attribute string into a JavaScript object or direct value
    parseAttributeString: function (attributeString) {
        // Handle flag components (e.g. light)
        if (!attributeString || attributeString.trim() === "") {
            return { __is_flag: true };
        }
        // If the string doesn't contain a colon, it's a direct value (e.g. scale="3 1 2")
        if (attributeString.indexOf(":") === -1) {
            return { __direct_value: attributeString.trim() };
        }
        const result = {};
        // Split by semicolons and then by colons to get key-value pairs (e.g. material="color: red; opacity: 0.5")
        const kvPairs = attributeString.split(";");
        for (let kvPair of kvPairs) {
            if (!kvPair.trim()) continue;
            // Split by the first colon to separate key and value
            const colonIndex = kvPair.indexOf(":");
            if (colonIndex === -1) continue;
            const key = kvPair.substring(0, colonIndex).trim();
            let value = kvPair.substring(colonIndex + 1).trim();
            // Convert value to appropriate type
            if (value === "true") value = true;
            else if (value === "false") value = false;
            else if (!isNaN(parseFloat(value)) && isFinite(value)) {
                value = parseFloat(value);
            }
            result[key] = value;
        }
        return result;
    },
    // Modifiers - Apply component modifications handling different component types
    // Note: newProps can be a flag component (e.g., __is_flag: true), a direct value component (e.g., __direct_value: "3 1 2"), or a property-based component with many properties (e.g., { prop1: "value1", prop2: "value2" })
    applyComponentModifications: function (componentName, newProps, saveOriginal = false) {
        // Skip if new props is empty or undefined
        if (!newProps || Object.keys(newProps).length === 0) return;
        // Save original state if needed and not already saved
        if (saveOriginal && !this.savedComponentStates[componentName]) {
            if (this.el.hasAttribute(componentName)) {
                this.savedComponentStates[componentName] = AFRAME.utils.clone(this.el.getAttribute(componentName));
            } else {
                // Mark that the component didn't exist
                this.savedComponentStates[componentName] = null;
            }
        }
        // Handle different types of component values
        if (newProps.__is_flag) {
            // It's a flag component, just add it without values
            this.el.setAttribute(componentName, "");
        } else if (newProps.__direct_value) {
            // It's a direct value component like position="3 1 2"
            this.el.setAttribute(componentName, newProps.__direct_value);
        } else {
            // It's a property-based component
            // Apply each property individually to ensure it's properly set
            for (const propName in newProps) {
                this.el.setAttribute(componentName, propName, newProps[propName]);
            }
        }
    },
    // Modifiers - Restore original component state
    restoreComponentState: function (componentName) {
        if (componentName in this.savedComponentStates) {
            const originalState = this.savedComponentStates[componentName];
            if (originalState === null) {
                // Component didn't exist originally, remove it
                this.el.removeAttribute(componentName);
            } else {
                // Restore the original state
                this.el.setAttribute(componentName, originalState);
            }
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
        // Test if the hand is inside the mesh
        let isInside = false;
        if (this.data.insideMeshDetection) {
            isInside = this.isHandInsideMesh(handEl);
        }
        // If the hand is not inside the mesh, and the object is not currently held (or is held by some other hand), remove event listeners
        if (!isInside && !(this.isHeld && handEl === this.holdingHand)) {
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
        // Modifiers - Apply all grip modifiers and save original states
        for (const componentName in this.gripModifiers) {
            this.applyComponentModifications(
                componentName,
                this.gripModifiers[componentName],
                true, // Save original state
            );
        }
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
            const sceneGrabPosAttr = this.el.sceneEl.getAttribute("data-holdable-grab-position");
            if (sceneGrabPosAttr) {
                customGrabPos = new THREE.Vector3().copy(AFRAME.utils.coordinates.parse(sceneGrabPosAttr));
                customGrabPos.x = handType === "left" ? -customGrabPos.x : customGrabPos.x;
                useCustomPos = true;
                isGlobalDefault = true;
            } else {
                // Fall back to the computed position (where it was actually grabbed).
                customGrabPos = pos;
                useCustomPos = false;
                // Debug - pasteable attribute to reproduce grab position/rotation
                if (this.data.debug) {
                    if (handType === "left") {
                        console.log("Use right hand to get position and rotation values. The left hand automatically mirrors the right.");
                    } else {
                        this.generateDebugGrabAttributes(pos, quat, handType);
                    }
                }
            }
        }
        // Determine the grab rotation.
        let customGrabQuat;
        if (this.data.rotation.x !== 0 || this.data.rotation.y !== 0 || this.data.rotation.z !== 0) {
            // Get the Euler angles for the custom rotation
            let customGrabRotationX = this.data.rotation.x;
            let customGrabRotationY = this.data.rotation.y;
            let customGrabRotationZ = this.data.rotation.z;
            // Invert specified axes for left hand
            if (handType === "left") {
                if (this.data.leftHandRotationInvert.includes("x")) {
                    customGrabRotationX = -customGrabRotationX;
                }
                if (this.data.leftHandRotationInvert.includes("y")) {
                    customGrabRotationY = -customGrabRotationY;
                }
                if (this.data.leftHandRotationInvert.includes("z")) {
                    customGrabRotationZ = -customGrabRotationZ;
                }
            }
            // Create the rotation quaternion from Euler angles (in radians)
            const euler = new THREE.Euler(
                THREE.MathUtils.degToRad(customGrabRotationX),
                THREE.MathUtils.degToRad(customGrabRotationY),
                THREE.MathUtils.degToRad(customGrabRotationZ),
                "YXZ", // The rotation order
            );
            // Save original object position and quaternion
            const origPosition = this.el.object3D.position.clone();
            const origQuaternion = this.el.object3D.quaternion.clone();
            // Apply rotation around object's own pivot before attaching to hand
            const rotationQuat = new THREE.Quaternion().setFromEuler(euler);
            this.el.object3D.quaternion.copy(rotationQuat);
            // Store this rotated state for application after attachment
            customGrabQuat = this.el.object3D.quaternion.clone();
            // Restore original state until we're ready to attach
            this.el.object3D.position.copy(origPosition);
            this.el.object3D.quaternion.copy(origQuaternion);
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
    // Generate debug grab attributes for easy copy-paste configuration for specific grab position/rotation
    generateDebugGrabAttributes: function (pos, quat) {
        const eulerForAttr = new THREE.Euler().setFromQuaternion(quat, "YXZ"); // Convert quaternion to Euler angles
        // Convert radians to degrees
        const rotX = THREE.MathUtils.radToDeg(eulerForAttr.x);
        let rotY = THREE.MathUtils.radToDeg(eulerForAttr.y);
        let rotZ = THREE.MathUtils.radToDeg(eulerForAttr.z);
        // Compute the bottom-corner offset
        const tempObj = this.el.object3D.clone(); // Create temporary copy of object
        tempObj.quaternion.copy(quat); // Apply the quaternion rotation to temp object
        tempObj.updateMatrixWorld(true); // Update matrix to reflect new rotation
        const bbox = new THREE.Box3().setFromObject(tempObj); // Calculate bounding box of rotated object
        const size = bbox.getSize(new THREE.Vector3()); // Get dimensions of bounding box
        const bottomCornerOffset = new THREE.Vector3(); // Create vector for offset calculation
        // Apply offset to position
        let posForAttr;
        bottomCornerOffset.set(size.x / 2, -size.y / 2, size.z / 2); // Set offset to bottom left corner (right hand)
        posForAttr = pos.clone().add(bottomCornerOffset); // Apply corner offset to position
        // Output copy-pasteable line to the console
        const posStr = posForAttr.x.toFixed(3) + " " + posForAttr.y.toFixed(3) + " " + posForAttr.z.toFixed(3);
        const rotStr = rotX.toFixed(1) + " " + rotY.toFixed(1) + " " + rotZ.toFixed(1);
        console.log(`holdable="position: ${posStr}; rotation: ${rotStr}"`);
    },
    onGripUp: function (evt) {
        if (!this.isHeld || !this.holdingHand) return;
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
        // Modifiers - Apply all release modifiers
        for (const componentName in this.releaseModifiers) {
            this.applyComponentModifications(
                componentName,
                this.releaseModifiers[componentName],
                false, // Don't save original state
            );
        }
        // Modifiers - Restore original states for components that don't have a release modifier
        for (const componentName in this.savedComponentStates) {
            if (!(componentName in this.releaseModifiers)) {
                this.restoreComponentState(componentName);
            }
        }
        // Modifiers - Clear saved component states
        this.savedComponentStates = {};
        // Emit grip-up event with details
        // Note: Located here so that entity is reparented back and modifiers are restored if applicable.
        this.el.emit("grip-up", {
            hand: this.holdingHand,
            entity: this.el,
        });
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
        // Check if the hand is still inside the mesh using raycasting. If so, don't remove the event listeners quite yet in case the user wants to grab it again right away and the hand is inside the mesh.
        let isInside = false;
        if (this.data.insideMeshDetection) {
            isInside = this.isHandInsideMesh(this.holdingHand);
        }
        if (!isInside) {
            this.holdingHand.removeEventListener("gripdown", this.onGripDown);
            this.holdingHand.removeEventListener("gripup", this.onGripUp);
            this.holdingHand = null;
        }
    },
    isHandInsideMesh: function (handEl) {
        // Get a unique identifier for the hand. Preference for id attribute, but fallback to the object's uuid.
        const handId = handEl.getAttribute("id") || handEl.object3D.uuid;
        const origin = handEl.object3D.getWorldPosition(new THREE.Vector3()); // Get the world position of the hand
        const direction = new THREE.Vector3(); // Set up a vector for the direction
        handEl.object3D.getWorldDirection(direction); // Get the forward direction of the hand.
        this.insideTestRaycaster.set(origin, direction.normalize());
        // Intersect the mesh (using recursive true in case the mesh is nested).
        const intersections = this.insideTestRaycaster.intersectObject(this.el.object3D, true);
            // console.log("Number of intersections for hand " + handId + ": " + intersections.length);
        // Odd number of intersections implies the hand is inside.
        const isInside = intersections.length % 2 === 1;
        this.insideMesh[handId] = isInside;
        return isInside;
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
