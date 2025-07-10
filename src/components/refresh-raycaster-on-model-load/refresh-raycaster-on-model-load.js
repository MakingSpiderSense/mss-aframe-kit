AFRAME.registerComponent("refresh-raycaster-on-model-load", {
    init: function () {
        const models = document.querySelectorAll("[gltf-model]:not(a-mixin)");
        // console.log({ models }); // 🐞
        // Get array of models that have already loaded
        let loadedModels = Array.from(models).filter((el) => el.components?.["gltf-model"]?.model).length;
        const modelsToLoad = models.length;
        // Function to check if all models have loaded and refresh raycasters
        const checkAllLoaded = () => {
            // console.log(`Checking if all models loaded: ${loadedModels}/${modelsToLoad}`); // 🐞
            if (loadedModels === modelsToLoad) {
                refreshRaycasters();
            }
        };
        const refreshRaycasters = () => {
            document.querySelectorAll("[raycaster]").forEach((ray) => {
                ray.components.raycaster.refreshObjects();
            });
        };
        // If all models are already loaded, refresh immediately
        checkAllLoaded();
        // Listen for remaining models to load
        models.forEach((el) => {
            el.addEventListener("model-loaded", () => {
                loadedModels++;
                checkAllLoaded();
            });
        });
        // Force refresh if models don't load within 5 seconds
        setTimeout(() => {
            if (loadedModels < modelsToLoad) {
                console.warn(`Not all models loaded after 5 seconds (${loadedModels}/${modelsToLoad}). Forcing raycaster refresh anyway.`);
                refreshRaycasters();
            }
        }, 5000);
    },
});
