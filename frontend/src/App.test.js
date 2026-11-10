import { render, screen, fireEvent, within, act } from "@testing-library/react";
import App from "./App";
import { api } from "./api";

jest.mock("./api", () => ({ ...jest.requireActual("./api"), api: jest.fn() }));
jest.mock("./Visualizer", () => function MockVisualizer({ buildings, highlightedIds, onSelectBuilding }) {
  return <div data-testid="scene" data-matches={highlightedIds.join(",")}>{buildings.map(b => <button key={b.id} onClick={() => onSelectBuilding(b)}>3D building {b.id}</button>)}</div>;
});
const buildings = [
  { id: "a", address: "100 TEST ST SW", height: 131.2, height_m: 40, zoning: "C-COR2", assessed_value: 450000, assessment_year: "2026", parcel_id: "p1", stage: "CONSTRUCTED", latitude: 51.04, longitude: -114.07 },
  { id: "b", address: null, height: 20, height_m: 6.1, zoning: null, assessed_value: null, stage: "CONSTRUCTED", latitude: 51.04, longitude: -114.07 },
];
const map = { area:"downtown", buildings, matchedParcels: 1, datasetVersion: "v1", fetchedAt: 1700000000, sources: [] };
let projects, queryResponse;
beforeAll(()=>{Element.prototype.scrollIntoView=jest.fn();});
beforeEach(() => {
  localStorage.clear(); projects = []; queryResponse = { buildingIds: ["a"], filters: { attribute: "height", operator: ">", value: 100 }, parser: "rules", warning: "Using query rules." };
  api.mockReset(); api.mockImplementation(async (path, options = {}) => {
    if (path === "/api/areas") return {areas:[{id:"downtown",name:"Downtown"},{id:"beltline",name:"Beltline"}]};
    if (path.startsWith("/api/buildings")) return {...map,area:path.includes("area=beltline") ? "beltline" : "downtown"};
    if (path === "/api/query") return queryResponse;
    if (path === "/api/user") return { id: 1, username: options.body.username };
    if (path === "/api/users/Alex/projects") {
      if (options.method === "POST") { const p = { id: 1, ...options.body }; projects.push(p); return p; }
      return { projects: [...projects] };
    }
    if (path.startsWith("/api/projects/1")) {
      if(options.method==="PATCH") { projects[0]={...projects[0],...options.body};return projects[0]; }
      if(options.method==="DELETE") {projects=[];return null;}
      return projects[0];
    }
    throw new Error(`Unexpected request: ${path}`);
  });
});
async function start() { render(<App />); await screen.findByRole("button", { name: "3D building a" }); }
async function identify() {
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "Alex" } });
  fireEvent.click(screen.getByRole("button", { name: "Use name" })); await screen.findByText("Using Alex.");
}
async function query() {
  fireEvent.change(screen.getByLabelText("Natural language query"), { target: { value: "over 100 feet" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply" })); await screen.findByText("1 match");
}
test("query, select, save and load reapply the same filters", async () => {
  await start(); await identify(); await query();
  expect(screen.getByTestId("scene")).toHaveAttribute("data-matches", "a");
  fireEvent.click(screen.getByRole("button", { name: "3D building a" }));
  const details = screen.getByRole("dialog", { name: "Building details" });
  expect(within(details).getByText("C-COR2")).toBeInTheDocument(); expect(within(details).getByText(/450,000/)).toBeInTheDocument();
  fireEvent.keyDown(document, { key: "Escape" }); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Tall buildings" } });
  fireEvent.click(screen.getByRole("button", { name: "Save project" })); await screen.findByText("Saved “Tall buildings”.");
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" })); expect(screen.getByTestId("scene")).toHaveAttribute("data-matches", "");
  fireEvent.click(await screen.findByRole("button", { name: "Tall buildings" }));
  await screen.findByText("Loaded “Tall buildings” and applied its filters.");
  expect(screen.getByTestId("scene")).toHaveAttribute("data-matches", "a");
  expect(api).toHaveBeenLastCalledWith("/api/query", expect.objectContaining({ body: expect.objectContaining({ filters: queryResponse.filters }) }));
});
test("zero matches is an explicit successful result", async () => {
  await start(); queryResponse = { ...queryResponse, buildingIds: [] };
  fireEvent.change(screen.getByLabelText("Natural language query"), { target: { value: "RC-G zoning" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(await screen.findByText("0 matches")).toBeInTheDocument(); expect(screen.getByText(/No buildings match in this area/)).toBeInTheDocument();
});
test("unmatched property attributes are explained", async () => {
  await start(); fireEvent.click(screen.getByRole("button", { name: "3D building b" }));
  expect(within(screen.getByRole("dialog")).getByText(/No reliable parcel match/)).toBeInTheDocument();
});
test("typing a username does not create users", async () => {
  await start(); fireEvent.change(screen.getByLabelText("Username"), { target: { value: "Alex" } });
  expect(api.mock.calls.filter(([path]) => path === "/api/user")).toHaveLength(0);
});
test("a failed map load can be retried", async () => {
  const original = api.getMockImplementation(); let attempts = 0;
  api.mockImplementation((path, options) => path.startsWith("/api/buildings") && attempts++ === 0 ? Promise.reject(new Error("Calgary unavailable")) : original(path, options));
  render(<App />); expect(await screen.findByRole("alert")).toHaveTextContent("Calgary unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Retry map" })); await screen.findByRole("button", { name: "3D building a" });
});
test("failed reapplication never announces project load success", async () => {
  projects = [{ id: 1, name: "Broken", filters: queryResponse.filters, query: "over 100 feet" }]; await start(); await identify();
  const original = api.getMockImplementation();
  api.mockImplementation((path, options) => path === "/api/query" ? Promise.reject(new Error("Filter request failed")) : original(path, options));
  fireEvent.click(await screen.findByRole("button", { name: "Broken" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Filter request failed"); expect(screen.queryByText(/Loaded “Broken”/)).not.toBeInTheDocument();
});
test("identity and saved projects survive remount", async () => {
  const first = render(<App />); await screen.findByRole("button", { name: "3D building a" }); await identify(); await query();
  fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Persisted" } });
  fireEvent.click(screen.getByRole("button", { name: "Save project" })); await screen.findByText("Saved “Persisted”.");
  first.unmount(); render(<App />); await screen.findByRole("button", { name: "Persisted" });
  expect(screen.getByLabelText("Username")).toHaveValue("Alex");
});


test("clearing filters cancels a project load that is still in flight", async () => {
  projects = [{ id: 1, name: "Slow project", filters: queryResponse.filters, query: "over 100 feet" }];
  await start(); await identify(); await query();
  const original = api.getMockImplementation(); let resolveProject;
  api.mockImplementation((path, options) => path.startsWith("/api/projects/1") ? new Promise(resolve => { resolveProject = resolve; }) : original(path, options));
  fireEvent.click(await screen.findByRole("button", { name: "Slow project" }));
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await act(async () => { resolveProject(projects[0]); });
  expect(screen.getByTestId("scene")).toHaveAttribute("data-matches", "");
  expect(screen.queryByText(/Loaded “Slow project”/)).not.toBeInTheDocument();
});


test("area switching clears filters and scopes subsequent queries",async() => {
  await start();await query();fireEvent.change(screen.getByLabelText("Neighbourhood"),{target:{value:"beltline"}});
  await screen.findByRole("button",{name:"3D building a"});
  expect(screen.queryByText("1 match")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Apply controls"}));await screen.findByText("1 match");
  expect(api).toHaveBeenLastCalledWith("/api/query",expect.objectContaining({body:expect.objectContaining({area:"beltline",source:"controls"})}));
});
test("loading a project fetches its area before applying its filters",async() => {
  projects=[{id:1,name:"Beltline saved",area:"beltline",notes:"Review streets",filters:queryResponse.filters,query:"over 100 feet"}];
  await start();await identify();fireEvent.click(await screen.findByRole("button",{name:"Beltline saved"}));
  await screen.findByText("Loaded “Beltline saved” and applied its filters.");
  expect(screen.getByLabelText("Neighbourhood")).toHaveValue("beltline");
  expect(screen.getByLabelText("Analysis notes")).toHaveValue("Review streets");
  expect(api).toHaveBeenCalledWith("/api/buildings?area=beltline",expect.anything());
  expect(api).toHaveBeenLastCalledWith("/api/query",expect.objectContaining({body:expect.objectContaining({area:"beltline"})}));
});
test("address search narrows displayed results without overwriting the active filter",async() => {
  await start();fireEvent.change(screen.getByLabelText("Find address or building ID in this area"),{target:{value:"TEST ST"}});
  expect(screen.getByText("1 displayed. Select for details, or zoom directly to a building.")).toBeInTheDocument();
  expect(screen.getByRole("button",{name:"Zoom to building a"})).toBeInTheDocument();
  expect(screen.queryByRole("button",{name:"Zoom to building b"})).not.toBeInTheDocument();
});


test("project edit and delete notices survive the project list refresh",async() => {
  projects=[{id:1,name:"Editable",area:"downtown",notes:"Original",filters:queryResponse.filters}];
  await start();await identify();fireEvent.click(await screen.findByRole("button",{name:"Edit Editable"}));
  fireEvent.change(screen.getByLabelText("Rename project"),{target:{value:"Updated project"}});
  fireEvent.click(screen.getByRole("button",{name:"Save changes"}));
  expect(await screen.findByText("Project updated.")).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button",{name:"Delete Updated project"}));
  fireEvent.click(screen.getByRole("button",{name:"Confirm delete"}));
  expect(await screen.findByText("Project deleted.")).toBeInTheDocument();
  await screen.findByText("No saved projects yet.");expect(screen.getByText("Project deleted.")).toBeInTheDocument();
});

test("comparison is capped at three buildings and removal frees a slot",async()=>{
  const original=api.getMockImplementation();
  api.mockImplementation((path,options)=>path.startsWith("/api/buildings") ? Promise.resolve({...map,buildings:[...buildings,{...buildings[0],id:"c"},{...buildings[0],id:"d"}]}) : original(path,options));
  await start();
  for(const id of ["a","b","c"])fireEvent.click(screen.getByRole("button",{name:`Compare building ${id}`,exact:true}));
  expect(screen.getByRole("button",{name:"Compare building d",exact:true})).toBeDisabled();
  fireEvent.click(screen.getByRole("button",{name:"Remove building b from comparison"}));
  expect(screen.getByRole("button",{name:"Compare building d",exact:true})).toBeEnabled();
});
test("switching areas protects notes until the user chooses to clear the draft",async()=>{
  await start();fireEvent.change(screen.getByLabelText("Analysis notes"),{target:{value:"Keep my observation"}});
  fireEvent.change(screen.getByLabelText("Neighbourhood"),{target:{value:"beltline"}});
  expect(screen.getByText(/Switch areas\? Unsaved notes/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Stay in this area"}));expect(screen.getByLabelText("Analysis notes")).toHaveValue("Keep my observation");
  fireEvent.change(screen.getByLabelText("Neighbourhood"),{target:{value:"beltline"}});
  fireEvent.click(screen.getByRole("button",{name:"Switch and clear draft"}));await screen.findByRole("button",{name:"3D building a"});
  expect(screen.getByLabelText("Analysis notes")).toHaveValue("");
});

test("loading an analysis protects changed notes before replacing the current draft",async()=>{
  projects=[{id:1,name:"Another analysis",area:"downtown",notes:"Saved notes",filters:queryResponse.filters}];
  await start();await identify();fireEvent.change(screen.getByLabelText("Analysis notes"),{target:{value:"My unsaved draft"}});
  fireEvent.click(await screen.findByRole("button",{name:"Another analysis",exact:true}));
  expect(screen.getByText(/Load another analysis\?/)).toBeInTheDocument();
  expect(document.activeElement.id).toBe("projects-tools");
  expect(api.mock.calls.filter(([path])=>path.startsWith("/api/projects/1"))).toHaveLength(0);
  fireEvent.click(screen.getByRole("button",{name:"Keep current draft"}));expect(screen.getByLabelText("Analysis notes")).toHaveValue("My unsaved draft");
  fireEvent.click(screen.getByRole("button",{name:"Another analysis",exact:true}));fireEvent.click(screen.getByRole("button",{name:"Load and replace draft"}));
  await screen.findByText("Loaded “Another analysis” and applied its filters.");expect(screen.getByLabelText("Analysis notes")).toHaveValue("Saved notes");
});
