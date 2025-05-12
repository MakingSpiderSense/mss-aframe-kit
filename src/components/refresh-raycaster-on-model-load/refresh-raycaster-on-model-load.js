AFRAME.registerComponent("refresh-raycaster-on-model-load", {
    init: function () {
        const models = document.querySelectorAll("[gltf-model]");
        // Get array of models that have already loaded
        let loadedModels = Array.from(models).filter((el) => el.components?.["gltf-model"]?.model).length;
        const modelsToLoad = models.length;
        // Function to check if all models have loaded and refresh raycasters
        const checkAllLoaded = () => {
            if (loadedModels === modelsToLoad) {
                document.querySelectorAll("[raycaster]").forEach((ray) => {
                    ray.components.raycaster.refreshObjects();
                });
            }
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
    },
});
