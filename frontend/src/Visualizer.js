/** Vector basemap and authoritative Calgary footprints share one map camera. */
import {useEffect,useRef,useState} from 'react';
import {Map,Marker,NavigationControl,ScaleControl} from './mapEngine';
import {EMPTY_STYLE,evidenceStyle,buildingColor,buildingsGeoJSON,buildingFocusBounds} from './mapGeometry';
import 'maplibre-gl/dist/maplibre-gl.css';

const STYLE_URL=process.env.REACT_APP_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/positron';
const CANVAS_LABEL='Interactive building map. Arrow keys pan, plus and minus zoom. Shift and arrow keys rotate or tilt. R resets, T opens top view.';
export default function Visualizer(props) {
  const {selectedBuilding,highlightedIds,streets,buildings,origin,bbox,resetKey,viewMode,focusTarget,searchReference}=props;
  const container=useRef(null),mapRef=useRef(null),current=useRef(props),baseLayers=useRef([]),retry=useRef(null);
  const [error,setError]=useState(''),[loading,setLoading]=useState(true),[fatal,setFatal]=useState(false);
  current.current=props;
  useEffect(()=>{
    let map,cancelled=false,controller=null;
    const sync=()=>{
      const p=current.current;
      if(!map.getLayer('calgary-buildings'))return;
      map.setPaintProperty('calgary-buildings','fill-extrusion-color',buildingColor(p.selectedBuilding?.id,p.highlightedIds,p.searchReference?.buildingId));
      for(const id of baseLayers.current)if(map.getLayer(id))map.setLayoutProperty(id,'visibility',p.streets ? 'visible' : 'none');
    };
    const fit=()=>{
      const {bbox,viewMode}=current.current;
      map.fitBounds([[bbox.min_lon,bbox.min_lat],[bbox.max_lon,bbox.max_lat]],{padding:65,maxZoom:16.7,pitch:viewMode==='top' ? 0 : 45,bearing:0,duration:0});
    };
    try {
      const p=current.current;
      map=new Map({container:container.current,style:evidenceStyle(EMPTY_STYLE,p.buildings,p.origin,p.bbox),
        center:[p.origin.lon,p.origin.lat],zoom:15,pitch:45,maxPitch:60,minZoom:10,maxZoom:20,
        attributionControl:{compact:true},canvasContextAttributes:{antialias:true}});
      mapRef.current=map;
      map.addControl(new NavigationControl({visualizePitch:true}),'top-right');
      map.addControl(new ScaleControl({unit:'metric'}),'bottom-left');
      map.getCanvas().setAttribute('aria-label',CANVAS_LABEL);
      map.on('load',fit);map.on('style.load',sync);
      map.on('click',event=>{
        const feature=map.getLayer('calgary-buildings') && map.queryRenderedFeatures(event.point,{layers:['calgary-buildings']})[0];
        current.current.onSelectBuilding(feature ? current.current.buildings.find(b=>b.id===feature.properties.buildingId) || null : null);
      });
      map.on('mousemove',event=>{
        map.getCanvas().style.cursor=map.getLayer('calgary-buildings') && map.queryRenderedFeatures(event.point,{layers:['calgary-buildings']}).length ? 'pointer' : '';
      });
      map.on('error',()=>{if(!cancelled)setError('Some basemap data could not load. Calgary buildings and filters remain available.');});
      const keyboard=event=>{
        if(event.key.toLowerCase()==='r'){event.preventDefault();current.current.onReset();}
        if(event.key.toLowerCase()==='t'){event.preventDefault();current.current.onTop();}
      };
      map.getCanvas().addEventListener('keydown',keyboard);
      const resize=new ResizeObserver(()=>map.resize());resize.observe(container.current);
      const loadBase=async()=>{
        controller?.abort();controller=new AbortController();setLoading(true);setError('');
        try {
          const response=await fetch(STYLE_URL,{signal:controller.signal});
          if(!response.ok)throw new Error('Basemap unavailable');
          const base=await response.json();
          if(cancelled)return;
          const p=current.current,style=evidenceStyle(base,p.buildings,p.origin,p.bbox);
          baseLayers.current=style.layers.filter(l=>!['plain-ground','calgary-buildings','study-boundary'].includes(l.id)).map(l=>l.id);
          map.setStyle(style,{diff:false});
        }catch(e){if(!cancelled && e.name!=='AbortError')setError('The basemap could not load. Calgary buildings and filters remain available.');}
        finally{if(!cancelled)setLoading(false);}
      };
      retry.current=loadBase;loadBase();
      return()=>{cancelled=true;controller?.abort();resize.disconnect();map.getCanvas().removeEventListener('keydown',keyboard);map.remove();mapRef.current=null;retry.current=null;};
    }catch(e){setFatal(true);setLoading(false);setError('The 3D map could not start. You can still inspect buildings in Results.');map?.remove();mapRef.current=null;}
  },[]);
  useEffect(()=>{
    const map=mapRef.current;if(!map)return;
    const sync=()=>{
      if(!map.getLayer('calgary-buildings'))return;
      map.setPaintProperty('calgary-buildings','fill-extrusion-color',buildingColor(selectedBuilding?.id,highlightedIds,searchReference?.buildingId));
      for(const id of baseLayers.current)if(map.getLayer(id))map.setLayoutProperty(id,'visibility',streets ? 'visible' : 'none');
    };
    sync();
  },[selectedBuilding,highlightedIds,streets,searchReference?.buildingId]);
  useEffect(()=>{
    const map=mapRef.current,search=current.current.searchReference;if(!map || !search)return;
    const button=document.createElement('button');button.type='button';button.className='search-map-pin';
    button.textContent='Your search · '+search.label;button.title=search.label;
    button.setAttribute('aria-label',`Your search: ${search.label}`);
    button.addEventListener('click',event=>{event.stopPropagation();current.current.onSearchPointClick?.();});
    const marker=new Marker({element:button,anchor:'bottom'}).setLngLat([search.point.lon,search.point.lat]).addTo(map);
    return()=>marker.remove();
  },[searchReference?.point.lon,searchReference?.point.lat,searchReference?.label]);
  useEffect(()=>{
    const map=mapRef.current;if(!map)return;
    const sync=()=>{map.getSource('calgary-buildings')?.setData(buildingsGeoJSON(buildings,origin));};
    sync();map.on('style.load',sync);return()=>map.off('style.load',sync);
  },[buildings,origin]);
  useEffect(()=>{
    const map=mapRef.current;if(!map)return;
    map.fitBounds([[bbox.min_lon,bbox.min_lat],[bbox.max_lon,bbox.max_lat]],{padding:65,maxZoom:16.7,pitch:viewMode==='top' ? 0 : 45,bearing:0,duration:0});
  },[bbox,resetKey,viewMode]); // Intentional area/reset camera changes only.
  useEffect(()=>{
    const map=mapRef.current,b=focusTarget?.building;if(!map || !b)return;
    map.fitBounds(buildingFocusBounds(b,origin),{padding:60,maxZoom:18,pitch:45,duration:500});
  },[focusTarget,origin]);
  return <div className="scene-wrapper vector-map"><div ref={container} className="vector-map-surface" />
    {(loading || error) && <div className="street-status" role={fatal ? 'alert' : 'status'}>{error || 'Loading vector basemap…'}{error && !fatal && <button className="text-button" onClick={()=>retry.current?.()}>Retry basemap</button>}</div>}
  </div>;
}
