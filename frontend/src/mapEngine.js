import {Map,NavigationControl,ScaleControl,setWorkerUrl} from 'maplibre-gl';
// Webpack emits the self-contained worker as a versioned, same-origin asset.
setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs',import.meta.url).href);
export {Map,NavigationControl,ScaleControl};
