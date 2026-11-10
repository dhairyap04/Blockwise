import {StreetLayer} from './streetLayer';
const tile=id=>({id});
const texture=()=>({dispose:jest.fn()});
function setup(limit) {
  const requests=new Map(),notify=jest.fn();
  const layer=new StreetLayer(t=>new Promise((resolve,reject)=>requests.set(t.id,{resolve,reject})),notify,limit);
  return {layer,requests,notify};
}
test('keeps the previous complete streets visible until every replacement loads',async()=>{
  const {layer,requests,notify}=setup();
  const first=layer.update([tile('old')]);requests.get('old').resolve(texture());await first;
  const next=layer.update([tile('new-a'),tile('new-b')]);
  expect(layer.visible.map(t=>t.id)).toEqual(['old']);
  requests.get('new-a').resolve(texture());await Promise.resolve();
  expect(layer.visible.map(t=>t.id)).toEqual(['old']);
  requests.get('new-b').resolve(texture());await next;
  expect(layer.visible.map(t=>t.id)).toEqual(['new-a','new-b']);expect(notify.mock.calls.at(-1)[1]).toBe('');
});
test('a failed replacement and retry preserve old tiles and reuse successful downloads',async()=>{
  const {layer,requests,notify}=setup();
  let p=layer.update([tile('old')]);requests.get('old').resolve(texture());await p;
  p=layer.update([tile('a'),tile('b')]);requests.get('a').resolve(texture());requests.get('b').reject(new Error('offline'));await p;
  expect(layer.visible.map(t=>t.id)).toEqual(['old']);expect(notify.mock.calls.at(-1)[1]).toContain('unavailable');
  p=layer.update([tile('a'),tile('b')]);requests.get('b').resolve(texture());await p;
  expect(layer.visible.map(t=>t.id)).toEqual(['a','b']);
});
test('obsolete responses and invalid views cannot replace the latest view',async()=>{
  const {layer,requests}=setup();
  const old=layer.update([tile('slow')]),latest=layer.update([tile('fast')]);
  requests.get('fast').resolve(texture());await latest;
  requests.get('slow').resolve(texture());await old;await layer.update([]);
  expect(layer.visible.map(t=>t.id)).toEqual(['fast']);
});
test('cache eviction protects displayed textures and disposal handles late downloads',async()=>{
  const {layer,requests,notify}=setup(1),oldTexture=texture(),currentTexture=texture(),lateTexture=texture();
  let p=layer.update([tile('old')]);requests.get('old').resolve(oldTexture);await p;
  p=layer.update([tile('current')]);requests.get('current').resolve(currentTexture);await p;
  expect(oldTexture.dispose).toHaveBeenCalledTimes(1);expect(currentTexture.dispose).not.toHaveBeenCalled();
  p=layer.update([tile('late')]);layer.dispose();notify.mockClear();requests.get('late').resolve(lateTexture);await p;
  expect(currentTexture.dispose).toHaveBeenCalledTimes(1);expect(lateTexture.dispose).toHaveBeenCalledTimes(1);expect(notify).not.toHaveBeenCalled();
});
