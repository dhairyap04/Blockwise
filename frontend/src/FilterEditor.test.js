import { render,screen,fireEvent } from "@testing-library/react";
import FilterEditor from "./FilterEditor";
test("controls apply typed numeric conditions with explicit units",() => {
  const apply=jest.fn();render(<FilterEditor onApply={apply} />);
  fireEvent.change(screen.getByLabelText("Condition 1 value"),{target:{value:"45"}});
  fireEvent.click(screen.getByRole("button",{name:"Add condition"}));
  fireEvent.change(screen.getByLabelText("Condition 2 attribute"),{target:{value:"zoning"}});
  fireEvent.change(screen.getByLabelText("Condition 2 value"),{target:{value:"R-CG"}});
  fireEvent.click(screen.getByRole("button",{name:"Apply controls"}));
  expect(apply).toHaveBeenCalledWith({logic:"and",conditions:[{attribute:"height_m",operator:">",value:45},{attribute:"zoning",operator:"=",value:"R-CG"}]});
});
test("loading a saved filter updates controls instead of retaining a stale draft",() => {
  const {rerender}=render(<FilterEditor onApply={jest.fn()} filter={{attribute:"height",operator:">",value:100}} />);
  expect(screen.getByLabelText("Condition 1 attribute")).toHaveValue("height");
  rerender(<FilterEditor onApply={jest.fn()} filter={{attribute:"assessed_value",operator:"<",value:500000}} />);
  expect(screen.getByLabelText("Condition 1 value")).toHaveValue(500000);
});
