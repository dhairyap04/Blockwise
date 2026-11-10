import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { viewportTiles } from "./mapTiles";

export function groundFootprint(camera) {
  camera.updateMatrixWorld();
  const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0.15),ray=new THREE.Raycaster();
  const points=[];
  for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
    ray.setFromCamera(new THREE.Vector2(x,y),camera);
    const point=ray.ray.intersectPlane(plane,new THREE.Vector3());
    if(!point) return null;
    points.push([point.x,point.z]);
  }
  return points;
}
export default function StreetMap({origin,onStatus}) {
  const {camera,size,invalidate}=useThree();
  const [footprint,setFootprint]=useState(null),[,setRevision]=useState(0);
  const resources=useRef(new Map()),pending=useRef(new Map()),mounted=useRef(true),timer=useRef(null),signature=useRef("");
  const tiles=useMemo(()=>viewportTiles(footprint,origin),[footprint,origin]);
  useFrame(()=>{
    const key=[...camera.matrixWorld.elements,...camera.projectionMatrix.elements,size.width,size.height].map(n=>n.toFixed(3)).join(",");
    if(signature.current===key) return;
    signature.current=key;clearTimeout(timer.current);
    timer.current=setTimeout(()=>setFootprint(groundFootprint(camera)),180);
  });
  useEffect(()=>()=>{clearTimeout(timer.current);},[]);
  useEffect(()=>{
    let cancelled=false;
    const loader=new THREE.TextureLoader();loader.setCrossOrigin("anonymous");
    if(tiles.length) onStatus("Updating visible streets…");
    const promises=tiles.map(tile=>{
      const cached=resources.current.get(tile.id);
      if(cached){cached.used=Date.now();return Promise.resolve(cached);}
      if(pending.current.has(tile.id))return pending.current.get(tile.id);
      const promise=new Promise((resolve,reject)=>loader.load(tile.url,texture=>{
        pending.current.delete(tile.id);
        if(!mounted.current){texture.dispose();reject(new Error("Cancelled"));return;}
        texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
        const resource={texture,used:Date.now()};resources.current.set(tile.id,resource);
        setRevision(v=>v+1);invalidate();resolve(resource);
      },undefined,error=>{pending.current.delete(tile.id);reject(error);}));
      pending.current.set(tile.id,promise);return promise;
    });
    Promise.allSettled(promises).then(results=>{
      if(cancelled)return;
      const failed=results.filter(result=>result.status==="rejected").length;
      onStatus(failed ? `${failed} street tiles unavailable. Buildings and filters still work.` : "");
      const visible=new Set(tiles.map(tile=>tile.id)),cache=resources.current;
      [...cache].filter(([id])=>!visible.has(id)).sort((a,b)=>a[1].used-b[1].used).slice(0,Math.max(0,cache.size-72)).forEach(([id,item])=>{item.texture.dispose();cache.delete(id);});
    });
    return ()=>{cancelled=true;};
  },[tiles,onStatus,invalidate]);
  useEffect(()=>{mounted.current=true;const cache=resources.current;return()=>{mounted.current=false;cache.forEach(item=>item.texture.dispose());cache.clear();};},[]);
  return <group>{tiles.map(tile=>{
    const resource=resources.current.get(tile.id);return resource ? <mesh key={tile.id} rotation={[-Math.PI/2,0,0]} position={tile.position}>
      <planeGeometry args={[tile.width,tile.height]} /><meshBasicMaterial map={resource.texture} toneMapped={false} />
    </mesh> : null;
  })}</group>;
}
