import { useEffect, useRef, useState } from "react";
import "./App.css";
import AgentGenPage from "../features/agent-gen/AgentGenPage";
import EvaluationPage from "../features/evaluation/EvaluationPage";
import PlanningPage from "../features/planning/PlanningPage";
import WorkflowEditorPage from "../features/workflow/WorkflowEditorPage";

type Route = "planning" | "evaluation" | "agentgen" | "editor";

const getRoute = (): Route => {
  const hash = window.location.hash.replace("#", "");
  if (hash.startsWith("/planning")) return "planning";
  if (hash.startsWith("/evaluation") || hash.startsWith("/evals") || hash.startsWith("/metrics")) {
    return "evaluation";
  }
  if (hash.startsWith("/agentgen")) return "agentgen";
  return "editor";
};

export default function App() {
  const [route, setRoute] = useState<Route>(() => getRoute());
  const [isNavigating, setIsNavigating] = useState(false);
  const routeRef = useRef<Route>(route);
  const navigationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    const handleChange = () => {
      const nextRoute = getRoute();
      if (nextRoute === routeRef.current) return;
      setIsNavigating(true);
      if (navigationTimerRef.current) {
        window.clearTimeout(navigationTimerRef.current);
      }
      navigationTimerRef.current = window.setTimeout(() => {
        setRoute(nextRoute);
        routeRef.current = nextRoute;
        setIsNavigating(false);
        navigationTimerRef.current = null;
      }, 320);
    };
    window.addEventListener("hashchange", handleChange);
    return () => {
      window.removeEventListener("hashchange", handleChange);
      if (navigationTimerRef.current) {
        window.clearTimeout(navigationTimerRef.current);
      }
    };
  }, []);

  let content = <WorkflowEditorPage />;
  if (route === "planning") content = <PlanningPage />;
  if (route === "evaluation") content = <EvaluationPage />;
  if (route === "agentgen") content = <AgentGenPage />;

  return (
    <div className="relative">
      {isNavigating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white/90 px-6 py-5 shadow-lg">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
            <div className="text-sm font-semibold text-slate-700">Loading page...</div>
          </div>
        </div>
      )}
      {content}
    </div>
  );
}
