import { CommandsButton } from "@/components/commands-button";
import TargetSelect from "@/components/target-select";
import { cn, isMobilePhone, isTouchDevice } from "@/lib/utils";
import type { Document } from "@flok-editor/session";
import { Play } from "lucide-react";
import { PropsWithChildren, useMemo } from "react";
import { LargeButton } from "./large-button";
import { ButtonProps } from "./ui/button";

const EvaluateButton = (props: ButtonProps) => (
  <LargeButton {...props}>
    <Play />
  </LargeButton>
);

interface PaneProps extends PropsWithChildren {
  document: Document;
  halfHeight?: boolean;
  isSinglePaneLayout?: boolean;
  onTargetChange: (document: Document, target: string) => void;
  onEvaluateButtonClick: (document: Document) => void;
  onCommandsButtonClick?: () => void;
}

export const Pane = ({
  children,
  document,
  halfHeight,
  isSinglePaneLayout,
  onTargetChange,
  onEvaluateButtonClick,
  onCommandsButtonClick,
}: PaneProps) => {
  const isMobile = useMemo(() => isMobilePhone(), []);

  return (
    <div
      className={cn(
        "flex overflow-auto relative",
        halfHeight ? "h-[50vh]" : "h-screen",
      )}
    >
      <TargetSelect
        triggerProps={{
          className: cn(
            isSinglePaneLayout ? "fixed top-1" : "absolute top-0",
            "z-10 w-auto h-6 border-none focus:ring-0 focus:ring-offset-0 p-1 bg-slate-900 bg-opacity-70",
          ),
        }}
        value={document.target}
        onValueChange={(target) => onTargetChange(document, target)}
      />
      {children}
      {isTouchDevice() && (
        <div
          className={cn(
            isMobile ? "fixed top-2" : "absolute top-8",
            "z-10 right-2 flex flex-col gap-2",
          )}
        >
          {isMobile && (
            <CommandsButton
              className="p-2 bg-slate-900 bg-opacity-70 h-10 w-10"
              onClick={onCommandsButtonClick}
            />
          )}
          <EvaluateButton onClick={() => onEvaluateButtonClick(document)} />
        </div>
      )}
    </div>
  );
};
