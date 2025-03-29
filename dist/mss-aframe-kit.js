/*! mss-aframe-kit v1.0.2 */
(function(factory) {
  typeof define === "function" && define.amd ? define(factory) : factory();
})(function() {
  "use strict";
  function triggerHaptics(hand, duration, force) {
    const leftHand = document.querySelector("#left-hand");
    const rightHand = document.querySelector("#right-hand");
    if (hand === "left") {
      initVibration(leftHand, duration, force);
    } else if (hand === "right") {
      initVibration(rightHand, duration, force);
    } else if (hand === "both") {
      initVibration(leftHand, duration, force);
      initVibration(rightHand, duration, force);
    }
  }
  function triggerHapticPattern(hand, pattern) {
    const leftHand = document.querySelector("#left-hand");
    const rightHand = document.querySelector("#right-hand");
    let totalDuration = 0;
    pattern.forEach((step) => {
      setTimeout(() => {
        console.log(`Vibrating ${hand} hand for ${step.duration}ms with intensity ${step.intensity}`);
        if (hand === "left") {
          initVibration(leftHand, step.duration, step.intensity);
        } else if (hand === "right") {
          initVibration(rightHand, step.duration, step.intensity);
        } else if (hand === "both") {
          initVibration(leftHand, step.duration, step.intensity);
          initVibration(rightHand, step.duration, step.intensity);
        }
      }, totalDuration);
      totalDuration += step.duration;
    });
  }
  function initVibration(hand, duration, force) {
    const maxDuration = 5e3;
    if (duration <= maxDuration) {
      hand.setAttribute("haptics__trigger", `dur: ${duration}; force: ${force}`);
      hand.emit("trigger-vibration");
    } else {
      let vibrate = function() {
        if (remainingDuration > maxDuration) {
          hand.setAttribute("haptics__trigger", `dur: ${maxDuration}; force: ${force}`);
          hand.emit("trigger-vibration");
          remainingDuration -= maxDuration;
          setTimeout(vibrate, maxDuration);
        } else {
          hand.setAttribute("haptics__trigger", `dur: ${remainingDuration}; force: ${force}`);
          hand.emit("trigger-vibration");
        }
      };
      let remainingDuration = duration;
      vibrate();
    }
  }
  const __vite_glob_0_0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    initVibration,
    triggerHapticPattern,
    triggerHaptics
  }, Symbol.toStringTag, { value: "Module" }));
  AFRAME.registerComponent("delayed-dynamic-body", {
    schema: {
      delay: { type: "number", default: 2e3 }
      // delay in milliseconds
    },
    init: function() {
      const sceneEl = this.el.sceneEl;
      const addBody = () => {
        setTimeout(() => {
          this.el.setAttribute("dynamic-body", "");
        }, this.data.delay);
      };
      if (sceneEl.hasLoaded) {
        addBody();
      } else {
        sceneEl.addEventListener("loaded", addBody);
      }
    }
  });
  const __vite_glob_0_1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  AFRAME.registerComponent("holdable", {
    schema: {
      position: { type: "vec3", default: { x: 0, y: 0, z: 0 } },
      rotation: { type: "vec3", default: { x: 0, y: 0, z: 0 } }
    },
    // dependencies: ['raycaster'], // This causes huge performance issues and is not needed at all, but good for benchmarking performance of models
    init: function() {
      this.isHeld = false;
      this.holdingHand = null;
      this.originalParent = this.el.parentElement;
      this.savedPhysics = [];
      this.savedSleepy = null;
      this.sleepyTimerActive = false;
      this.previousHandPosition = null;
      this.handVelocity = new THREE.Vector3();
      this.rayActive = false;
      this.insideMesh = {};
      this.insideTestRaycaster = new THREE.Raycaster();
      this.insideTestRaycaster.far = 10;
      this.onGripDown = this.onGripDown.bind(this);
      this.onGripUp = this.onGripUp.bind(this);
      this.onHitStart = this.onHitStart.bind(this);
      this.onHitEnd = this.onHitEnd.bind(this);
      this.el.addEventListener("raycaster-intersected", this.onHitStart);
      this.el.addEventListener("raycaster-intersected-cleared", this.onHitEnd);
      this.physicsDriver = this.el.sceneEl.getAttribute("physics");
      if (!this.el.classList.contains("interactable")) {
        this.el.classList.add("interactable");
      }
    },
    tick: function(time, delta) {
      if (this.isHeld && this.holdingHand) {
        const currentPos = this.holdingHand.object3D.getWorldPosition(new THREE.Vector3());
        if (this.previousHandPosition) {
          const velocity = currentPos.clone().sub(this.previousHandPosition).multiplyScalar(1e3 / delta);
          this.handVelocity.copy(velocity);
        }
        this.previousHandPosition = currentPos.clone();
      }
    },
    onHitStart: function(evt) {
      const handEl = evt.detail.el.closest("[meta-touch-controls], [oculus-touch-controls], [hand-controls]");
      if (!handEl) {
        return;
      }
      if (this.isHeld) {
        return;
      }
      this.rayActive = true;
      this.holdingHand = handEl;
      this.holdingHand.removeEventListener("gripdown", this.onGripDown);
      this.holdingHand.removeEventListener("gripup", this.onGripUp);
      this.holdingHand.addEventListener("gripdown", this.onGripDown);
      this.holdingHand.addEventListener("gripup", this.onGripUp);
    },
    onHitEnd: function(evt) {
      const handEl = evt.detail.el.closest("[meta-touch-controls], [oculus-touch-controls], [hand-controls]");
      if (!handEl) {
        return;
      }
      const handId = handEl.getAttribute("id") || handEl.object3D.uuid;
      const origin = handEl.object3D.getWorldPosition(new THREE.Vector3());
      const direction = new THREE.Vector3();
      handEl.object3D.getWorldDirection(direction);
      this.insideTestRaycaster.set(origin, direction.normalize());
      const intersections = this.insideTestRaycaster.intersectObject(this.el.object3D, true);
      const isInside = intersections.length % 2 === 1;
      this.insideMesh[handId] = isInside;
      if (!this.insideMesh[handId] && !(this.isHeld && handEl === this.holdingHand)) {
        handEl.removeEventListener("gripdown", this.onGripDown);
        handEl.removeEventListener("gripup", this.onGripUp);
      }
      this.rayActive = false;
    },
    onGripDown: function(evt) {
      const hasHoldableDynamicBody = this.el.hasAttribute("holdable-dynamic-body");
      const hasShapeComponents = Object.keys(this.el.components).some((key) => key.includes("shape__"));
      if (this.isHeld) {
        return;
      }
      const handEl = evt.target.closest("[meta-touch-controls], [oculus-touch-controls], [hand-controls]");
      if (!handEl) {
        return;
      }
      this.holdingHand = handEl;
      if (this.el.hasAttribute("dynamic-body")) {
        this.savedPhysics = [{
          type: "dynamic-body",
          config: this.el.getAttribute("dynamic-body")
        }];
        this.el.removeAttribute("dynamic-body");
      } else if (this.el.hasAttribute("ammo-body")) {
        this.savedPhysics = [{
          type: "ammo-body",
          config: this.el.getAttribute("ammo-body")
        }];
        this.el.removeAttribute("ammo-body");
      } else if (this.el.hasAttribute("body") || hasHoldableDynamicBody && hasShapeComponents) {
        const bodyAttributes = this.el.getAttribute("body");
        const bodyType = hasHoldableDynamicBody && hasShapeComponents ? "dynamic" : bodyAttributes ? bodyAttributes.type : "dynamic";
        const bodyShape = bodyAttributes ? bodyAttributes.shape : "auto";
        const bodyMass = bodyAttributes ? bodyAttributes.mass : 5;
        const bodyLinearDamping = bodyAttributes ? bodyAttributes.linearDamping : "0.01";
        const bodyAngularDamping = bodyAttributes ? bodyAttributes.angularDamping : "0.01";
        const bodySphereRadius = bodyAttributes ? bodyAttributes.sphereRadius : "";
        const bodyCylinderAxis = bodyAttributes ? bodyAttributes.cylinderAxis : "";
        this.savedPhysics = [];
        if (bodyType === "dynamic") {
          this.savedPhysics = [{
            type: "body",
            config: { type: bodyType, shape: bodyShape, mass: bodyMass, linearDamping: bodyLinearDamping, angularDamping: bodyAngularDamping, sphereRadius: bodySphereRadius, cylinderAxis: bodyCylinderAxis }
          }];
          this.el.removeAttribute("body");
        }
        const shapeComponents = this.el.components;
        for (const key in shapeComponents) {
          if (key.includes("shape__")) {
            let shapeName = key;
            if (!shapeName.match(/\d+$/)) {
              shapeName += "100";
            } else {
              const num = parseInt(shapeName.match(/\d+$/)[0]);
              shapeName = shapeName.replace(/\d+$/, num + 100);
            }
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
              config: { shape, offset, orientation, radius, halfExtents, radiusTop, radiusBottom, height, numSegments }
            });
          }
        }
        if (this.el.hasAttribute("sleepy")) {
          this.savedSleepy = this.el.getAttribute("sleepy");
          this.el.removeAttribute("sleepy");
        }
      }
      this.isHeld = true;
      this.previousHandPosition = this.holdingHand.object3D.getWorldPosition(new THREE.Vector3());
      this.handVelocity.set(0, 0, 0);
      const handObj = this.holdingHand.object3D;
      const handData = this.holdingHand.getAttribute("meta-touch-controls") || this.holdingHand.getAttribute("oculus-touch-controls") || this.holdingHand.getAttribute("hand-controls") || {};
      const handType = handData.hand || "right";
      handObj.updateMatrixWorld(true);
      this.el.object3D.updateMatrixWorld(true);
      const worldMatrix = this.el.object3D.matrixWorld.clone();
      const handInverse = new THREE.Matrix4().copy(handObj.matrixWorld).invert();
      const localMatrix = new THREE.Matrix4().multiplyMatrices(handInverse, worldMatrix);
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      localMatrix.decompose(pos, quat, scale);
      let customGrabPos;
      let useCustomPos = false;
      let isGlobalDefault = false;
      if (this.data.position.x !== 0 || this.data.position.y !== 0 || this.data.position.z !== 0) {
        customGrabPos = new THREE.Vector3(this.data.position.x, this.data.position.y, this.data.position.z);
        customGrabPos.x = handType === "left" ? -customGrabPos.x : customGrabPos.x;
        useCustomPos = true;
      } else {
        const sceneGrabPosAttr = this.el.sceneEl.getAttribute("data-grab-position");
        if (sceneGrabPosAttr) {
          customGrabPos = new THREE.Vector3().copy(AFRAME.utils.coordinates.parse(sceneGrabPosAttr));
          customGrabPos.x = handType === "left" ? -customGrabPos.x : customGrabPos.x;
          useCustomPos = true;
          isGlobalDefault = true;
        } else {
          customGrabPos = pos;
          useCustomPos = false;
        }
      }
      let customGrabQuat;
      if (this.data.rotation.x !== 0 || this.data.rotation.y !== 0 || this.data.rotation.z !== 0) {
        let customGrabRotationY = handType === "left" ? -this.data.rotation.y : this.data.rotation.y;
        let customGrabRotationZ = handType === "left" ? -this.data.rotation.z : this.data.rotation.z;
        const euler = new THREE.Euler(
          THREE.MathUtils.degToRad(this.data.rotation.x),
          THREE.MathUtils.degToRad(customGrabRotationY),
          THREE.MathUtils.degToRad(customGrabRotationZ)
        );
        customGrabQuat = new THREE.Quaternion().setFromEuler(euler);
      } else {
        customGrabQuat = quat;
      }
      let finalPos;
      if (useCustomPos) {
        let size;
        if (!isGlobalDefault) {
          const tempObj = this.el.object3D.clone();
          tempObj.quaternion.copy(customGrabQuat);
          tempObj.updateMatrixWorld(true);
          const bbox = new THREE.Box3().setFromObject(tempObj);
          size = bbox.getSize(new THREE.Vector3());
        } else {
          const bbox = new THREE.Box3().setFromObject(this.el.object3D);
          size = bbox.getSize(new THREE.Vector3());
        }
        const bottomCornerOffset = new THREE.Vector3();
        if (handType === "left") {
          bottomCornerOffset.set(-size.x / 2, -size.y / 2, size.z / 2);
        } else {
          bottomCornerOffset.set(size.x / 2, -size.y / 2, size.z / 2);
        }
        finalPos = customGrabPos.clone().sub(bottomCornerOffset);
      } else {
        finalPos = pos;
      }
      handObj.attach(this.el.object3D);
      this.el.object3D.position.copy(finalPos);
      this.el.object3D.quaternion.copy(customGrabQuat);
      this.el.object3D.updateMatrixWorld(true);
    },
    onGripUp: function(evt) {
      if (!this.isHeld || !this.holdingHand) {
        return;
      }
      this.el.object3D.updateMatrixWorld(true);
      this.originalParent.object3D.attach(this.el.object3D);
      this.el.object3D.updateMatrixWorld(true);
      if (this.savedPhysics) {
        this.savedPhysics.forEach((saved) => {
          this.el.setAttribute(saved.type, saved.config);
        });
        this.savedPhysics = null;
      }
      if (this.savedSleepy) {
        if (this.sleepyTimerId) {
          clearTimeout(this.sleepyTimerId);
        } else {
          this.sleepyTimerActive = true;
        }
        this.sleepyTimerId = setTimeout(() => {
          this.el.setAttribute("sleepy", `allowSleep: true; speedLimit: ${this.savedSleepy.speedLimit}; delay: ${this.savedSleepy.delay}; angularDamping: ${this.savedSleepy.angularDamping}; linearDamping: ${this.savedSleepy.linearDamping}; holdState: ${this.savedSleepy.holdState};`);
          this.savedSleepy = null;
          this.sleepyTimerActive = false;
          this.sleepyTimerId = null;
        }, 4e3);
      }
      if (this.el.hasAttribute("holdable-dynamic-body") && !this.el.hasAttribute("body")) {
        if (this.el.hasAttribute("static-body")) {
          this.el.removeAttribute("static-body");
        }
        const dynamicBodyData = this.el.getAttribute("holdable-dynamic-body");
        this.el.setAttribute("dynamic-body", dynamicBodyData);
      }
      this.isHeld = false;
      setTimeout(() => {
        if (this.el.body && this.handVelocity) {
          let throwVelocity = this.handVelocity.clone().multiplyScalar(1.5);
          throwVelocity.y += 1;
          if (this.physicsDriver.driver === "local") {
            this.el.body.velocity.set(throwVelocity.x, throwVelocity.y, throwVelocity.z);
          } else if (this.physicsDriver.driver === "ammo") {
            this.el.body.setLinearVelocity(new Ammo.btVector3(throwVelocity.x, throwVelocity.y, throwVelocity.z));
          }
        }
      }, 50);
      const handEls = document.querySelectorAll("[meta-touch-controls], [oculus-touch-controls], [hand-controls]");
      if (handEls) {
        handEls.forEach((handEl) => {
          const handData = handEl.getAttribute("meta-touch-controls") || handEl.getAttribute("oculus-touch-controls") || handEl.getAttribute("hand-controls") || {};
          const handType = handData.hand || "right";
          const rayEl = handEl.querySelector("[raycaster]");
          const rayData = rayEl == null ? void 0 : rayEl.getAttribute("raycaster");
          if (rayData && typeof rayData.far === "number") {
            if (rayEl.getAttribute(`data-tempFar-active-${handType}`)) ;
            else {
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
      const handPos = this.holdingHand.object3D.getWorldPosition(new THREE.Vector3());
      const bbox = new THREE.Box3().setFromObject(this.el.object3D);
      if (!bbox.containsPoint(handPos)) {
        this.holdingHand.removeEventListener("gripdown", this.onGripDown);
        this.holdingHand.removeEventListener("gripup", this.onGripUp);
        this.holdingHand = null;
      }
    },
    remove: function() {
      this.el.removeEventListener("raycaster-intersected", this.onHitStart);
      this.el.removeEventListener("raycaster-intersected-cleared", this.onHitEnd);
      if (this.holdingHand) {
        this.holdingHand.removeEventListener("gripdown", this.onGripDown);
        this.holdingHand.removeEventListener("gripup", this.onGripUp);
      }
    }
  });
  const __vite_glob_0_2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  AFRAME.registerComponent("music-player", {
    schema: { songs: { type: "array", default: [] } },
    init: function() {
      const sceneEl = this.el.sceneEl;
      const leftController = document.querySelector("#left-hand");
      if (!leftController) {
        console.error("No #left-hand controller found for music-player");
        return;
      }
      leftController.addEventListener("xbuttonup", () => this.togglePause());
      leftController.addEventListener("ybuttonup", () => this.nextTrack());
      document.addEventListener("keyup", (e) => {
        if (e.code === "Space") {
          this.togglePause();
        } else if (e.code === "KeyN") {
          this.nextTrack();
        }
      });
      if (this.data.songs.length === 0) {
        let storedSongs = localStorage.getItem("musicPlayerSongs");
        if (storedSongs) {
          try {
            let parsedSongs = JSON.parse(storedSongs);
            if (Array.isArray(parsedSongs) && parsedSongs.length > 0) {
              this.data.songs = parsedSongs;
            }
          } catch (e) {
            console.warn("Error parsing musicPlayerSongs from localStorage", e);
          }
        }
      }
      if (this.data.songs.length === 0) {
        console.warn("No songs found for music-player");
        return;
      }
      this.currentPlaylist = this.shuffle(this.data.songs.slice());
      this.audio = new Audio();
      this.audio.addEventListener("ended", () => {
        this.playNextSong();
      });
      this.audio.addEventListener("error", (e) => {
        console.error("Error loading song: " + this.currentSong, e);
        this.playNextSong();
      });
      this.boundStartPlayback = this.startPlayback.bind(this);
      document.addEventListener("click", this.boundStartPlayback, { once: true });
      sceneEl.addEventListener("enter-vr", () => {
        if (AFRAME.utils.device.checkHeadsetConnected()) {
          console.log("VR entered, starting music playback");
          this.boundStartPlayback();
          document.removeEventListener("click", this.boundStartPlayback);
        }
      });
    },
    startPlayback: function() {
      this.playNextSong();
    },
    playNextSong: function() {
      if (this.currentPlaylist.length === 0) {
        this.currentPlaylist = this.shuffle(this.data.songs.slice());
        console.log("Playlist resetting");
      }
      let nextSong = this.currentPlaylist.pop();
      nextSong = nextSong.trim();
      if (nextSong.startsWith("'")) {
        nextSong = nextSong.slice(1);
      }
      if (nextSong.endsWith("'")) {
        nextSong = nextSong.slice(0, -1);
      }
      this.currentSong = nextSong;
      console.log("Playing: " + nextSong);
      this.audio.src = "assets/audio/music/" + encodeURI(nextSong);
      this.audio.play();
    },
    // Toggle pause/resume
    togglePause: function() {
      if (this.audio.paused) {
        this.audio.play();
      } else {
        this.audio.pause();
      }
    },
    // Skip to next track
    nextTrack: function() {
      this.playNextSong();
    },
    shuffle: function(array) {
      for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }
  });
  const __vite_glob_0_3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  AFRAME.registerComponent("raycaster-listener", {
    init: function() {
      console.log("Raycaster Listener initialized");
      const el = this.el;
      const originalColor = "#ffffff";
      const styledRay = document.querySelectorAll(".styled-ray");
      const reticle = document.querySelector("#reticle");
      el.addEventListener("raycaster-intersected", function(evt) {
        styledRay.forEach(function(ray) {
          ray.setAttribute("material", "color", "#A2F5A2");
        });
        if (reticle) {
          reticle.setAttribute("geometry", "radius", ".008");
        }
        const handEl = evt.detail.el.closest("[meta-touch-controls], [oculus-touch-controls], [hand-controls]");
        if (handEl) {
          const handData = handEl.getAttribute("meta-touch-controls") || handEl.getAttribute("oculus-touch-controls") || handEl.getAttribute("hand-controls") || {};
          const handType = handData.hand || "right";
          triggerHaptics(handType, 150, 0.1);
        }
      });
      el.addEventListener("raycaster-intersected-cleared", function() {
        styledRay.forEach(function(ray) {
          ray.setAttribute("material", "color", originalColor);
        });
        if (reticle) {
          reticle.setAttribute("geometry", "radius", ".005");
        }
      });
    }
  });
  const __vite_glob_0_4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  AFRAME.registerComponent("raycaster-manager", {
    init: function() {
      console.log("Raycaster Manager initialized");
      const leftController = document.querySelector("#left-hand");
      const rightController = document.querySelector("#right-hand");
      if (leftController && rightController) {
        leftController.addEventListener("triggerdown", () => this.toggleRaycaster("left"));
        rightController.addEventListener("triggerdown", () => this.toggleRaycaster("right"));
      }
    },
    // Toggle logic for raycaster
    toggleRaycaster: function(hand) {
      const actualRay = document.querySelector(`#${hand}-hand .actual-ray`);
      if (actualRay.getAttribute("raycaster").enabled) {
        console.log("Raycaster already active on this controller:", hand);
        if (!actualRay.components.raycaster.intersectedEls.length) {
          console.log("No intersection detected. Disabling raycaster on:", hand);
          this.disableRaycaster(hand);
        }
      } else {
        console.log("Enabling raycaster on:", hand);
        this.enableRaycaster(hand);
      }
    },
    // Disable raycaster
    disableRaycaster: function(hand) {
      const styledRay = document.querySelector(`#${hand}-hand .styled-ray`);
      const actualRay = document.querySelector(`#${hand}-hand .actual-ray`);
      styledRay == null ? void 0 : styledRay.setAttribute("visible", false);
      actualRay == null ? void 0 : actualRay.setAttribute("raycaster", "enabled", false);
    },
    // Enable raycaster
    enableRaycaster: function(hand) {
      const styledRay = document.querySelector(`#${hand}-hand .styled-ray`);
      const actualRay = document.querySelector(`#${hand}-hand .actual-ray`);
      styledRay == null ? void 0 : styledRay.setAttribute("visible", true);
      actualRay == null ? void 0 : actualRay.setAttribute("raycaster", { enabled: true });
      if (styledRay) {
        this.playSound(styledRay);
      }
      const otherHand = hand === "left" ? "right" : "left";
      this.disableRaycaster(otherHand);
    },
    // Play sound
    playSound: function(styledRay) {
      let soundComp = styledRay.components.sound;
      if (soundComp) {
        soundComp.playSound();
      }
    }
  });
  const __vite_glob_0_5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  AFRAME.registerComponent("refresh-raycaster-on-model-load", {
    init: function() {
      const models = document.querySelectorAll("[gltf-model]");
      let loadedModels = Array.from(models).filter((el) => {
        var _a, _b;
        return (_b = (_a = el.components) == null ? void 0 : _a["gltf-model"]) == null ? void 0 : _b.model;
      }).length;
      const modelsToLoad = models.length;
      const checkAllLoaded = () => {
        if (loadedModels === modelsToLoad) {
          document.querySelectorAll("[raycaster]").forEach((ray) => {
            ray.components.raycaster.refreshObjects();
          });
        }
      };
      checkAllLoaded();
      models.forEach((el) => {
        el.addEventListener("model-loaded", () => {
          loadedModels++;
          checkAllLoaded();
        });
      });
    }
  });
  const __vite_glob_0_6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  AFRAME.registerComponent("vr-logger", {
    schema: {
      maxMessages: { type: "int", default: 5 }
      // Maximum number of messages to display
    },
    // Initialize the component
    init: function() {
      const enableVrLogger = localStorage.getItem("enableVrLogger");
      if (!enableVrLogger || enableVrLogger !== "true") {
        console.log("VR Logger is disabled.");
        return;
      }
      this.messages = [];
      this.el.setAttribute("text", {
        color: "white",
        width: 3,
        // Width of the text box
        wrapCount: 45,
        // Number of characters per line before wrapping
        align: "left"
      });
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        originalConsoleLog(...args);
        this.addMessage(args.map((a) => a.toString()).join(" "));
      };
    },
    // Add a message to the console
    addMessage: function(message) {
      if (this.messages.length >= this.data.maxMessages) {
        this.messages.shift();
      }
      this.messages.push(message + "\n");
      this.updateText();
    },
    // Update the text displayed in the VR console
    updateText: function() {
      this.el.setAttribute("text", "value", this.messages.join("\n"));
    }
  });
  const __vite_glob_0_7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  AFRAME.registerComponent("vr-mode-detect", {
    init: function() {
      const sceneEl = this.el.sceneEl;
      const reticle = document.getElementById("reticle");
      sceneEl == null ? void 0 : sceneEl.addEventListener("enter-vr", function() {
        if (AFRAME.utils.device.checkHeadsetConnected()) {
          reticle == null ? void 0 : reticle.setAttribute("visible", "false");
          reticle == null ? void 0 : reticle.setAttribute("raycaster", "enabled", false);
        }
      });
      sceneEl == null ? void 0 : sceneEl.addEventListener("exit-vr", function() {
        reticle == null ? void 0 : reticle.setAttribute("visible", "true");
        reticle == null ? void 0 : reticle.setAttribute("raycaster", "enabled", true);
      });
    }
  });
  const __vite_glob_0_8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  const components = /* @__PURE__ */ Object.assign({ "./components/_helpers/helpers.js": __vite_glob_0_0, "./components/delayed-dynamic-body/delayed-dynamic-body.js": __vite_glob_0_1, "./components/holdable/holdable.js": __vite_glob_0_2, "./components/music-player/music-player.js": __vite_glob_0_3, "./components/raycaster-listener/raycaster-listener.js": __vite_glob_0_4, "./components/raycaster-manager/raycaster-manager.js": __vite_glob_0_5, "./components/refresh-raycaster-on-model-load/refresh-raycaster-on-model-load.js": __vite_glob_0_6, "./components/vr-logger/vr-logger.js": __vite_glob_0_7, "./components/vr-mode-detect/vr-mode-detect.js": __vite_glob_0_8 });
  console.log("MSS A-Frame Kit Loaded", components);
});
//# sourceMappingURL=mss-aframe-kit.js.map
