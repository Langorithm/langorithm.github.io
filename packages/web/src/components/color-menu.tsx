import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ColorSettings } from "@flok-editor/cm-learn";
import { Palette } from "lucide-react";

// Ways to tone the code colouring down, each its own toggle, to try
// combinations on real code.
const toggles: { key: keyof ColorSettings; label: string }[] = [
  { key: "shades", label: "Shades: nested levels in one colour family" },
  { key: "twoLevels", label: "Two levels: top level and nested" },
  { key: "bracketsOnly", label: "Brackets only: contents stay plain" },
  { key: "quietFunctions", label: "Quiet functions: colour chain starts only" },
  { key: "evenOperators", label: "Even operators: not dimmed" },
];

export function ColorMenu({
  settings,
  onChange,
}: {
  settings: ColorSettings;
  onChange: (settings: ColorSettings) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="h-6 w-6 flex items-center justify-center rounded-md bg-slate-900 bg-opacity-70 text-slate-300 hover:text-white"
        title="Code colours"
      >
        <Palette className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Code colours</DropdownMenuLabel>
        {toggles.map(({ key, label }) => (
          <DropdownMenuCheckboxItem
            key={key}
            checked={settings[key]}
            // Keep the menu open to try several in a row.
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(checked) =>
              onChange({ ...settings, [key]: checked })
            }
          >
            {label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
