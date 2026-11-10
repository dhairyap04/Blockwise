import {render,screen,fireEvent} from "@testing-library/react";
import AddressStudySearch from "./AddressStudySearch";
import {api} from "./api";
jest.mock("./api",()=>({api:jest.fn()}));
const match={address:"800 MACLEOD TR SE",latitude:51.045397,longitude:-114.057927};
beforeEach(()=>api.mockReset());
test("an address must be chosen explicitly before creating its bounded study area",async()=>{
  const choose=jest.fn();api.mockResolvedValueOnce({matches:[match]}).mockResolvedValueOnce({id:"address-example",name:match.address});
  render(<AddressStudySearch onChoose={choose} />);
  fireEvent.change(screen.getByLabelText("Calgary address or landmark"),{target:{value:"800 Macleod Trail SE"}});
  fireEvent.click(screen.getByRole("button",{name:"Find address or landmark"}));
  const button=await screen.findByRole("button",{name:/Use 800 MACLEOD TR SE/});expect(choose).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Study square width"),{target:{value:"1600"}});fireEvent.click(button);
  await screen.findByText(/Study area prepared/);
  expect(api).toHaveBeenLastCalledWith("/api/areas/address",{method:"POST",body:{...match,size_m:1600}});expect(choose).toHaveBeenCalledWith({id:"address-example",name:match.address});
});
test("no matches explains how to recover",async()=>{
  api.mockResolvedValue({matches:[]});render(<AddressStudySearch onChoose={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Calgary address or landmark"),{target:{value:"Not a street"}});fireEvent.click(screen.getByRole("button",{name:"Find address or landmark"}));
  expect(await screen.findByText(/No address or listed landmark matched/)).toBeInTheDocument();
});

test('landmark names show their address and source and use a server registry ID',async()=>{
  api.mockResolvedValueOnce({matches:[],landmarks:[{landmarkId:'brookfield-place',name:'Brookfield Place',address:'225 6 AV SW',latitude:51.0474,longitude:-114.0661,source:{url:'https://example.test/owner'},reviewedAt:'2026-11-10'}]}).mockResolvedValueOnce({id:'address-example',name:'Brookfield Place'});
  const choose=jest.fn();render(<AddressStudySearch onChoose={choose} />);
  fireEvent.change(screen.getByLabelText('Calgary address or landmark'),{target:{value:'Brookfield Place'}});
  fireEvent.click(screen.getByRole('button',{name:'Find address or landmark'}));
  fireEvent.click(await screen.findByRole('button',{name:/Use Brookfield Place/}));
  await screen.findByText(/Study area prepared/);
  expect(api.mock.calls.at(-1)[1].body.landmarkId).toBe('brookfield-place');expect(choose).toHaveBeenCalled();
  expect(screen.getByRole('link',{name:'Name and address source'})).toHaveAttribute('href','https://example.test/owner');
});
