import { render,screen,fireEvent } from "@testing-library/react";
import ProjectList from "./ProjectList";
import { api } from "./api";
jest.mock("./api",()=>({api:jest.fn()}));
const project={id:3,name:"My analysis",area:"beltline",notes:"Original"};
beforeEach(()=>api.mockReset());
test("renaming and notes changes preserve the project identity",async() => {
  api.mockResolvedValue({...project,name:"New name",notes:"Updated"});const refresh=jest.fn();
  render(<ProjectList projects={[project]} username="Alex" areas={[]} onRefresh={refresh} onLoad={jest.fn()} />);
  fireEvent.click(screen.getByRole("button",{name:"Edit My analysis"}));
  fireEvent.change(screen.getByLabelText("Rename project"),{target:{value:"New name"}});
  fireEvent.change(screen.getByLabelText("Project notes"),{target:{value:"Updated"}});
  fireEvent.click(screen.getByRole("button",{name:"Save changes"}));
  await screen.findByText("Project updated.");expect(api).toHaveBeenCalledWith("/api/projects/3?username=Alex",{method:"PATCH",body:{name:"New name",notes:"Updated"}});expect(refresh).toHaveBeenCalled();
});
test("deletion waits for the explicit confirmation control",async() => {
  api.mockResolvedValue(null);render(<ProjectList projects={[project]} username="Alex" areas={[]} onRefresh={jest.fn()} onLoad={jest.fn()} />);
  fireEvent.click(screen.getByRole("button",{name:"Delete My analysis"}));expect(api).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Cancel delete"}));expect(api).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Delete My analysis"}));fireEvent.click(screen.getByRole("button",{name:"Confirm delete"}));
  await screen.findByText("Project deleted.");expect(api).toHaveBeenCalledWith("/api/projects/3?username=Alex",{method:"DELETE"});
});
