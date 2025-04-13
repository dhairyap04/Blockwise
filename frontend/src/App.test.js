import { render, screen, fireEvent } from "@testing-library/react";
import App from "./App";

test('renders learn react link', () => {
  render(<App />);
  const linkElement = screen.getByText(/learn react/i);
  expect(linkElement).toBeInTheDocument();
});

test("checks if the search button works", () => {
  render(<App />);

  // Find the search button
  const searchButton = screen.getByText(/search/i);

  // Simulate a click event
  fireEvent.click(searchButton);

  // Check if the page updates to indicate the button works
  const confirmationMessage = screen.getByText(/button works!/i);
  expect(confirmationMessage).toBeInTheDocument();
});
