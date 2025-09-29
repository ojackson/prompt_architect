import { ErrorBoundary } from "./components/ErrorBoundary";
import PromptArchitect from "./PromptArchitect";

export default function App() {
  return (
    <div className="container">
      <div className="card">
        <ErrorBoundary>
          <PromptArchitect />
        </ErrorBoundary>
      </div>
    </div>
  );
}
