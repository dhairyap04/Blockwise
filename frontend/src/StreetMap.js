import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { viewportTiles } from "./mapTiles";
import { StreetLayer } from "./streetLayer";

export function groundFootprint(camera) {
  camera.updateMatrixWorld();
  const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0.15),ray=new THREE.Raycaster();
  const points=[];
  for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
    ray.setFromCamera(new THREE.Vector2(x,y),camera);
    const point=ray.ray.intersectPlane(plane,new THREE.Vector3());
    if(!point || !Number.isFinite(point.x) || !Number.isFinite(point.z))return null;
    points.push([point.x,point.z]);
  }
  return points;
}
export default function StreetMap({origin,onStatus,retryKey}) {
  const {camera,size,invalidate}=useThree();
  const [visible,setVisible]=useState([]),[tiles,setTiles]=useState([]);
  const layer=useRef(null),signature=useRef(''),lastSample=useRef(-Infinity),wake=useRef(null);
  useFrame(({clock})=>{
    // Throttle during movement rather than waiting indefinitely for an orbit
    // to stop. Request only a changed tile set, not every camera matrix.
    if(clock.elapsedTime-lastSample.current<0.18){
      if(!wake.current)wake.current=setTimeout(()=>{wake.current=null;invalidate();},180);
      return;
    }
    lastSample.current=clock.elapsedTime;
    const next=viewportTiles(groundFootprint(camera),origin);
    if(!next.length)return; // A transient horizon view must not clear streets.
    const key=next.map(t=>t.id).join(',');
    if(key!==signature.current){signature.current=key;setTiles(next);}
  });
  useEffect(()=>{
    const loader=new THREE.TextureLoader();loader.setCrossOrigin('anonymous');
    const active=new StreetLayer(tile=>new Promise((resolve,reject)=>loader.load(tile.url,texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;
      texture.anisotropy=4;resolve(texture);
    },undefined,reject)),(next,status)=>{setVisible([...next]);onStatus(status);invalidate();});
    layer.current=active;
    return()=>{clearTimeout(wake.current);wake.current=null;active.dispose();layer.current=null;};
  },[onStatus,invalidate]);
  useEffect(()=>{layer.current?.update(tiles);},[tiles,retryKey]);
  // A demand-rendered scene needs another frame after resize to sample it.
  useEffect(()=>{lastSample.current=-Infinity;invalidate();},[size.width,size.height,invalidate]);
  return <group>{visible.map(tile=>{
    const texture=layer.current?.cache.get(tile.id);
    return texture ? <mesh key={tile.id} renderOrder={-1} rotation={[-Math.PI/2,0,0]} position={tile.position}>
      <planeGeometry args={[tile.width,tile.height]} />
      <meshBasicMaterial map={texture} toneMapped={false} depthTest={false} depthWrite={false} />
    </mesh> : null;
  })}</group>;
}
