import {render,screen,fireEvent} from '@testing-library/react';
import NearbyBuildings from './NearbyBuildings';
const anchor={id:'home',address:'Home',latitude:51,longitude:-114};
const buildings=[anchor,{id:'near',latitude:51.0001,longitude:-114},{id:'far',latitude:51.001,longitude:-114},{id:'third',latitude:51.002,longitude:-114}];
test('starting a comparison includes the anchor and two nearest buildings, without changing the reference',()=>{
  const start=jest.fn();render(<NearbyBuildings anchor={anchor} buildings={buildings} comparison={[]} onStart={start} onAdd={jest.fn()} onZoom={jest.fn()} />);
  fireEvent.click(screen.getByRole('button',{name:'Compare with two neighbours'}));
  expect(start).toHaveBeenCalledWith(['home','near','far']);
});
test('an existing custom shortlist cannot be overwritten by the quick-start action',()=>{
  render(<NearbyBuildings anchor={anchor} buildings={buildings} comparison={['home','far','third']} onStart={jest.fn()} onAdd={jest.fn()} onZoom={jest.fn()} />);
  expect(screen.queryByRole('button',{name:'Compare with two neighbours'})).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Compare nearby building near'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'Compare nearby building far'})).toBeEnabled();
});
test('ambiguous searches must be confirmed before suggestions are offered',()=>{
  render(<NearbyBuildings needsConfirmation buildings={buildings} comparison={[]} />);
  expect(screen.getByText('Confirm a reference footprint above to see nearby buildings.')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
