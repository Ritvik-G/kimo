// =============================================================================
// Toolbar Component - Top action buttons
// =============================================================================

import { useEffect, useId, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Theme } from "../../../shared/types";

type Props = {
  theme: Theme;
  fileInputRef: RefObject<HTMLInputElement | null>;
  downloadLabel?: string;
  onPlanBackClick?: () => void;
  onC3ANClick: () => void;
  onAboutClick: () => void;
  onPlanningClick?: () => void;
  onEvaluationClick?: () => void;
  onAgentGenClick?: () => void;
  onEvalsClick: () => void;
  onDownloadClick: () => void;
  onUploadClick: () => void;
  onRunClick: () => void;
  onResetClick: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function Toolbar({
  theme,
  fileInputRef,
  downloadLabel,
  onPlanBackClick,
  onC3ANClick,
  onAboutClick,
  onPlanningClick,
  onEvaluationClick,
  onAgentGenClick,
  onEvalsClick,
  onDownloadClick,
  onUploadClick,
  onRunClick,
  onResetClick,
  onFileUpload,
}: Props) {
  void onC3ANClick;
  void onEvalsClick;
  void onUploadClick;
  void onRunClick;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId().replace(/:/g, "");

  const actionButtonClass =
    theme === "dark"
      ? "toolbar-btn toolbar-btn-dark"
      : "toolbar-btn toolbar-btn-light";

  const menuPanelClass =
    theme === "dark"
      ? "toolbar-menu toolbar-menu-dark"
      : "toolbar-menu toolbar-menu-light";

  const menuItemClass =
    theme === "dark"
      ? "toolbar-menu-item toolbar-menu-item-dark"
      : "toolbar-menu-item toolbar-menu-item-light";

  const downloadText = downloadLabel ?? "Download JSON";

  useEffect(() => {
    if (!isMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current || menuRef.current.contains(event.target as Node)) return;
      setIsMenuOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isMenuOpen]);

  const handleMenuAction = (action: () => void) => {
    action();
    setIsMenuOpen(false);
  };

  return (
    <div className="absolute top-4 right-6 z-30 flex items-center gap-3">
      <div className="hidden lg:flex items-center gap-3">
        {onPlanBackClick && (
          <button className={actionButtonClass} onClick={onPlanBackClick}>
            Back
          </button>
        )}
        <button className={actionButtonClass} onClick={onAboutClick}>
          About
        </button>
        {onPlanningClick && (
          <button className={actionButtonClass} onClick={onPlanningClick}>
            PlanGen
          </button>
        )}
        {onEvaluationClick && (
          <button className={actionButtonClass} onClick={onEvaluationClick}>
            Evaluation
          </button>
        )}
        {onAgentGenClick && (
          <button className={actionButtonClass} onClick={onAgentGenClick}>
            AgentGen
          </button>
        )}
        <button className={actionButtonClass} onClick={onDownloadClick}>
          {downloadText}
        </button>
        <button className={actionButtonClass} onClick={onResetClick}>
          Reset
        </button>
      </div>

      <div className="relative lg:hidden" ref={menuRef}>
        <button
          className={actionButtonClass}
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-expanded={isMenuOpen}
          aria-controls={menuId}
        >
          Menu
        </button>
        {isMenuOpen && (
          <div id={menuId} className={menuPanelClass} role="menu">
            {onPlanBackClick && (
              <button
                className={menuItemClass}
                onClick={() => handleMenuAction(onPlanBackClick)}
                role="menuitem"
              >
                Back
              </button>
            )}
            <button className={menuItemClass} onClick={() => handleMenuAction(onAboutClick)} role="menuitem">
              About
            </button>
            {onPlanningClick && (
              <button className={menuItemClass} onClick={() => handleMenuAction(onPlanningClick)} role="menuitem">
                PlanGen
              </button>
            )}
            {onEvaluationClick && (
              <button className={menuItemClass} onClick={() => handleMenuAction(onEvaluationClick)} role="menuitem">
                Evaluation
              </button>
            )}
            {onAgentGenClick && (
              <button className={menuItemClass} onClick={() => handleMenuAction(onAgentGenClick)} role="menuitem">
                AgentGen
              </button>
            )}
            <button className={menuItemClass} onClick={() => handleMenuAction(onDownloadClick)} role="menuitem">
              {downloadText}
            </button>
            <button className={menuItemClass} onClick={() => handleMenuAction(onResetClick)} role="menuitem">
              Reset
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={onFileUpload}
      />
    </div>
  );
}
