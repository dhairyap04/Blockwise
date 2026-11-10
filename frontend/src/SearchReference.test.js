import {render,screen,fireEvent} from '@testing-library/react';
import SearchReference from './SearchReference';
test('nearby buildings are suggestions until explicitly chosen',()=>{
  const choose=jest.fn(),zoom=jest.fn();
  render(<SearchReference reference={{label:'Test address',address:'Test address',explanation:'Choose a candidate.',candidates:[{id:'a',distanceM:23.4,containsPoint:false}]}} buildings={[{id:'a',address:'Another address'}]} onChoose={choose} onZoom={zoom} />);
  expect(screen.getByText(/A building has not been confirmed/)).toBeInTheDocument();expect(choose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Inspect'}));expect(zoom).toHaveBeenCalledWith({id:'a',address:'Another address'});
  fireEvent.click(screen.getByRole('button',{name:'Use building a as reference'}));expect(choose).toHaveBeenCalledWith('a');
});
