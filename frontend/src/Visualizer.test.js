import {render,screen,act,fireEvent,waitFor} from '@testing-library/react';
import Visualizer from './Visualizer';
import {Map} from './mapEngine';
jest.mock('./mapEngine',()=>({Map:jest.fn(),NavigationControl:jest.fn(),ScaleControl:jest.fn()}));
const bbox={min_lon:-114.078,max_lon:-114.068,min_lat:51.044,max_lat:51.050};
const b={id:'a',height_m:40,footprint:[[0,0],[10,0],[10,10],[0,0]]};
let instance,events,canvas,resize;
const props={buildings:[b],origin:{lon:-114.073,lat:51.047},bbox,streets:true,highlightedIds:[],viewMode:'3d',resetKey:0,onReset:jest.fn(),onTop:jest.fn(),onSelectBuilding:jest.fn()};
beforeEach(()=>{
  events={};canvas=document.createElement('canvas');resize={observe:jest.fn(),disconnect:jest.fn()};global.ResizeObserver=jest.fn(()=>resize);
  instance={addControl:jest.fn(),getCanvas:()=>canvas,on:jest.fn((name,fn)=>{events[name]=fn;}),off:jest.fn(),getLayer:()=>({}),getSource:()=>({setData:jest.fn()}),queryRenderedFeatures:jest.fn(()=>[]),setPaintProperty:jest.fn(),setLayoutProperty:jest.fn(),fitBounds:jest.fn(),resize:jest.fn(),setStyle:jest.fn(),remove:jest.fn()};
  Map.mockClear();Map.mockImplementation(()=>instance);
  global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({version:8,sources:{},layers:[{id:'roads',type:'line'}]})});
});
test('selection, filters and streets update the existing map without resetting its camera',async()=>{
  const {rerender}=render(<Visualizer {...props} />);await waitFor(()=>expect(instance.setStyle).toHaveBeenCalled());
  instance.fitBounds.mockClear();rerender(<Visualizer {...props} selectedBuilding={b} highlightedIds={['a']} streets={false} />);
  expect(Map).toHaveBeenCalledTimes(1);expect(instance.fitBounds).not.toHaveBeenCalled();
  expect(instance.setLayoutProperty).toHaveBeenCalledWith('roads','visibility','none');
  expect(instance.setPaintProperty).toHaveBeenLastCalledWith('calgary-buildings','fill-extrusion-color',expect.arrayContaining(['#f97316']));
  act(()=>events.click({point:{x:1,y:1}}));expect(props.onSelectBuilding).toHaveBeenLastCalledWith(null);
  instance.queryRenderedFeatures.mockReturnValue([{properties:{buildingId:'a'}}]);
  act(()=>events.click({point:{x:1,y:1}}));expect(props.onSelectBuilding).toHaveBeenLastCalledWith(b);
});
test('a failed basemap keeps local building data available and can be retried',async()=>{
  fetch.mockRejectedValueOnce(new Error('offline'));render(<Visualizer {...props} />);
  await screen.findByText(/Calgary buildings and filters remain available/);
  expect(Map.mock.calls[0][0].style.sources['calgary-buildings'].data.features).toHaveLength(1);
  fireEvent.click(screen.getByRole('button',{name:'Retry basemap'}));await waitFor(()=>expect(instance.setStyle).toHaveBeenCalled());
});
test('keyboard actions remain available and map workers/listeners are released on unmount',async()=>{
  const {unmount}=render(<Visualizer {...props} />);await waitFor(()=>expect(instance.setStyle).toHaveBeenCalled());
  fireEvent.keyDown(canvas,{key:'r'});fireEvent.keyDown(canvas,{key:'t'});
  expect(props.onReset).toHaveBeenCalled();expect(props.onTop).toHaveBeenCalled();unmount();
  expect(instance.remove).toHaveBeenCalledTimes(1);expect(resize.disconnect).toHaveBeenCalled();
});
