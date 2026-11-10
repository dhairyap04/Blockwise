import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mapTiles } from "./mapTiles";
export default function StreetMap({bbox,origin,onStatus}) {
  const tiles=useMemo(() => mapTiles(bbox,origin),[bbox,origin]);
  const [loaded,setLoaded]=useState([]); const {invalidate}=useThree();
  useEffect(() => {
    let cancelled=false,completed=0,failed=0;const textures=[];
    setLoaded([]);onStatus(tiles.length ? "Loading street map…" : "Street map unavailable for this area.");
    const loader=new THREE.TextureLoader();loader.setCrossOrigin("anonymous");
    const done=() => {completed++;if(!cancelled && completed===tiles.length) onStatus(failed ? `${failed} street tiles unavailable. Buildings and filters still work.` : "");};
    tiles.forEach(tile => loader.load(tile.url, texture => {
      if(cancelled){texture.dispose();return;}
      textures.push(texture);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
      setLoaded(current => [...current,{tile,texture}]);invalidate();done();
    },undefined,() => {failed++;done();}));
    return () => {cancelled=true;textures.forEach(texture => texture.dispose());};
  },[tiles,onStatus,invalidate]);
  return <group>{loaded.map(({tile,texture}) => <mesh key={tile.id} rotation={[-Math.PI/2,0,0]} position={tile.position}>
    <planeGeometry args={[tile.width,tile.height]} /><meshBasicMaterial map={texture} toneMapped={false} />
  </mesh>)}</group>;
}
