import {render,screen,fireEvent} from "@testing-library/react";
import BuildingComparison from "./BuildingComparison";
test("comparison explains shared parcels and excludes unknown heights from the difference",()=>{
  const remove=jest.fn();render(<BuildingComparison buildings={[{id:"a",height_m:10,parcel_id:"p",assessed_value:1000},{id:"b",height_m:40,parcel_id:"p",assessed_value:1000},{id:"c",height_m:null}]} onRemove={remove} onClear={jest.fn()} onExport={jest.fn()} />);
  expect(screen.getByText(/Height range: 30.0 m/)).toBeInTheDocument();expect(screen.getByText(/Some buildings share a parcel/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Remove building a from comparison"}));expect(remove).toHaveBeenCalledWith("a");
});
