import {render,screen,fireEvent} from "@testing-library/react";
import AddressStudySearch from "./AddressStudySearch";
import {api} from "./api";
jest.mock("./api",()=>({api:jest.fn()}));
const match={address:"800 MACLEOD TR SE",latitude:51.045397,longitude:-114.057927};
beforeEach(()=>api.mockReset());
test("an address must be chosen explicitly before creating its bounded study area",async()=>{
  const choose=jest.fn();api.mockResolvedValueOnce({matches:[match]}).mockResolvedValueOnce({id:"address-example",name:match.address});
  render(<AddressStudySearch onChoose={choose} />);
  fireEvent.change(screen.getByLabelText("Calgary street address"),{target:{value:"800 Macleod Trail SE"}});
  fireEvent.click(screen.getByRole("button",{name:"Find Calgary address"}));
  const button=await screen.findByRole("button",{name:/Use 800 MACLEOD TR SE/});expect(choose).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Study square width"),{target:{value:"1600"}});fireEvent.click(button);
  await screen.findByText(/Study area prepared/);
  expect(api).toHaveBeenLastCalledWith("/api/areas/address",{method:"POST",body:{...match,size_m:1600}});expect(choose).toHaveBeenCalledWith({id:"address-example",name:match.address});
});
test("no matches explains how to recover",async()=>{
  api.mockResolvedValue({matches:[]});render(<AddressStudySearch onChoose={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Calgary street address"),{target:{value:"Not a street"}});fireEvent.click(screen.getByRole("button",{name:"Find Calgary address"}));
  expect(await screen.findByText(/No matching parcel addresses/)).toBeInTheDocument();
});
