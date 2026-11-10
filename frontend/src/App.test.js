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
const map = { buildings, matchedParcels: 1, datasetVersion: "v1", fetchedAt: 1700000000, sources: [] };
let projects, queryResponse;
beforeEach(() => {
  localStorage.clear(); projects = []; queryResponse = { buildingIds: ["a"], filters: { attribute: "height", operator: ">", value: 100 }, parser: "rules", warning: "Using query rules." };
  api.mockReset(); api.mockImplementation(async (path, options = {}) => {
    if (path.startsWith("/api/buildings")) return map;
    if (path === "/api/query") return queryResponse;
    if (path === "/api/user") return { id: 1, username: options.body.username };
    if (path === "/api/users/Alex/projects") {
      if (options.method === "POST") { const p = { id: 1, ...options.body }; projects.push(p); return p; }
      return { projects: [...projects] };
    }
    if (path.startsWith("/api/projects/1")) return projects[0];
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
