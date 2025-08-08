import { Filter } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export type SortAction =
  | { type: "alpha"; dir: "asc" | "desc" }
  | { type: "numeric"; dir: "asc" | "desc" }
  | { type: "sequence" }
  | { type: "reverse" }
  | { type: "pin"; value: string }
  | { type: "clear" };

type Variant = "alpha" | "numeric" | "categorical";

interface ColumnFilterMenuProps {
  variant: Variant;
  label: string;
  active?: SortAction | null;
  sequence?: string[]; // required for categorical
  onChange: (action: SortAction | null) => void;
  showSequence?: boolean;
  showReverse?: boolean;
}

const menuBtnBase = "w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent";

export default function ColumnFilterMenu({ variant, label, sequence = [], active, onChange, showSequence = true, showReverse = true }: ColumnFilterMenuProps) {
  const isActive = Boolean(active && active.type !== "clear");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={`h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? "text-[hsl(var(--primary))] opacity-100" : ""}`}
          title={`Sort/Filter ${label}`}
        >
          <Filter className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 p-1" sideOffset={6} align="end">
        {variant === "alpha" && (
          <div className="p-1">
            <div className="px-3 pt-1 pb-2 text-xs text-muted-foreground">{label}</div>
            <button className={menuBtnBase} onClick={() => onChange({ type: "alpha", dir: "asc" })}>A → Z</button>
            <button className={menuBtnBase} onClick={() => onChange({ type: "alpha", dir: "desc" })}>Z → A</button>
            <div className="border-t border-border my-1" />
            <button className={menuBtnBase} onClick={() => onChange(null)}>Clear</button>
          </div>
        )}

        {variant === "numeric" && (
          <div className="p-1">
            <div className="px-3 pt-1 pb-2 text-xs text-muted-foreground">{label}</div>
            <button className={menuBtnBase} onClick={() => onChange({ type: "numeric", dir: "asc" })}>Low → High</button>
            <button className={menuBtnBase} onClick={() => onChange({ type: "numeric", dir: "desc" })}>High → Low</button>
            <div className="border-t border-border my-1" />
            <button className={menuBtnBase} onClick={() => onChange(null)}>Clear</button>
          </div>
        )}

        {variant === "categorical" && (
          <div className="p-1">
            <div className="px-3 pt-1 pb-2 text-xs text-muted-foreground">{label}</div>
            {showSequence && (
              <button className={menuBtnBase} onClick={() => onChange({ type: "sequence" })}>Sequence</button>
            )}
            {showReverse && (
              <button className={menuBtnBase} onClick={() => onChange({ type: "reverse" })}>Reverse sequence</button>
            )}
            {sequence.length > 0 && (
              <>
                <div className="border-t border-border my-1" />
                <div className="px-3 py-1 text-xs text-muted-foreground">Bring to top</div>
                <div className="max-h-56 overflow-auto">
                  {sequence.map((s) => (
                    <button key={s} className={menuBtnBase} onClick={() => onChange({ type: "pin", value: s })}>
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="border-t border-border my-1" />
            <button className={menuBtnBase} onClick={() => onChange(null)}>Clear</button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

