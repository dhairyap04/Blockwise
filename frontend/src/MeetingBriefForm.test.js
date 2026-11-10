import {render,screen,fireEvent} from "@testing-library/react";
import MeetingBriefForm from "./MeetingBriefForm";
import {apiBlob} from "./api";
import {downloadFile} from "./analysis";
jest.mock("./api",()=>({apiBlob:jest.fn()}));jest.mock("./analysis",()=>({downloadFile:jest.fn()}));
beforeEach(()=>{apiBlob.mockReset();downloadFile.mockReset();});
test("PDF export sends selected IDs and version rather than client-supplied property values",async()=>{
  const blob=new Blob(["pdf"],{type:"application/pdf"});apiBlob.mockResolvedValue(blob);
  render(<MeetingBriefForm buildings={[{id:"a",assessed_value:99999999}]} context={{area:"downtown",datasetVersion:"v1",notes:"Discuss height"}} onNotesChange={jest.fn()} />);
  fireEvent.click(screen.getByText("Create meeting brief (PDF)"));fireEvent.click(screen.getByRole("button",{name:"Download meeting brief"}));
  await screen.findByText(/Meeting brief downloaded/);expect(apiBlob).toHaveBeenCalledWith("/api/brief",expect.objectContaining({buildingIds:["a"],datasetVersion:"v1",notes:"Discuss height"}));
  expect(apiBlob.mock.calls[0][1]).not.toHaveProperty("buildings");expect(downloadFile).toHaveBeenCalledWith("calgary-comparison-brief.pdf",blob,"application/pdf");
});
test("stale snapshot errors stay visible and allow retry",async()=>{
  apiBlob.mockRejectedValue(new Error("Building data changed. Reload the map."));render(<MeetingBriefForm buildings={[{id:"a"}]} context={{area:"downtown",datasetVersion:"old"}} onNotesChange={jest.fn()} />);
  fireEvent.click(screen.getByText("Create meeting brief (PDF)"));fireEvent.click(screen.getByRole("button",{name:"Download meeting brief"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("Building data changed");expect(screen.getByRole("button",{name:"Download meeting brief"})).toBeEnabled();
});
