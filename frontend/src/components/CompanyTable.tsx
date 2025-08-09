import { useEffect, useRef, useState } from "react";
import { getCollectionsById, ICompany, ICollection, startBulkAdd, deleteCompaniesFromCollection, ICollectionMeta } from "../utils/jam-api";
import { BackgroundTask } from "./BackgroundTasksManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, MoveRight, Heart, Trash2, SlidersHorizontal, LayoutGrid, Flag } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "@/components/ui/dropdown-menu";
import { Plus, Check } from "lucide-react";
import { createCollection, deleteCollection } from "@/utils/jam-api";
import ColumnFilterMenu, { SortAction } from "@/components/ColumnFilterMenu";


type SelectionMode = 'none' | 'all';

interface CompanyTableProps {
  selectedCollectionId: string;
  collectionResponse?: (ICollectionMeta | ICollection)[];
  onStartBulkTask: (task: BackgroundTask) => void;
  getCollectionName: (collectionId: string) => string;
  onChangeCollection: (collectionId: string) => void;
  refreshCollections: () => void;
}

const CompanyTable = (props: CompanyTableProps) => {
  // Stable facet list for Industry (matches backend seed in main.py)
  const ALL_INDUSTRIES = [
    "Healthcare Tech",
    "Education & EdTech",
    "Finance & FinTech",
    "Developer Tools",
    "Enterprise SaaS",
    "AI Infrastructure",
    "Climate & Energy",
    "E-commerce Enablement",
    "Cybersecurity",
    "Creator Economy",
  ];
  const FUNDING_ORDER = ["Pre-seed", "Seed", "Series A", "Series B", "Series C"] as const;
  const FUNDING_MAX: Record<typeof FUNDING_ORDER[number], number> = {
    "Pre-seed": 10,
    "Seed": 20,
    "Series A": 75,
    "Series B": 150,
    "Series C": 300,
  };
  const SIZE_RANGE_MIN: Record<string, number> = {
    "0-10": 0,
    "11-50": 11,
    "51-200": 51,
    "201-500": 201,
    "500+": 501,
  };
  // Note: depends on sizeRanges; compute after its declaration
  const [response, setResponse] = useState<ICompany[]>([]);
  const [allCompanies, setAllCompanies] = useState<ICompany[]>([]);
  const allCacheRef = useRef<Map<string, ICompany[]>>(new Map());
  const selectedCollectionIdRef = useRef<string>(props.selectedCollectionId);
  const isSwitchingRef = useRef<boolean>(false);
  // Only refresh once on the first 50-item increment during a bulk add
  const hasRefreshedFirstBucketRef = useRef<boolean>(false);
  const [total, setTotal] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const [pageSize] = useState(25);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('none');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCollectionsOpen, setIsCollectionsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  // Row Filters
  const [filterText, setFilterText] = useState<string>("");
  const [filterLikedOnly, setFilterLikedOnly] = useState<boolean>(false);
  const [industriesSelected, setIndustriesSelected] = useState<string[]>([]);
  const [sizeRanges, setSizeRanges] = useState<string[]>([]);
  const [fundingFilters, setFundingFilters] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const selectedMinTeamSize = sizeRanges.length > 0 ? Math.min(...sizeRanges.map(r => SIZE_RANGE_MIN[r])) : undefined;
  const DISPLAY_FUNDING = selectedMinTeamSize === undefined
    ? FUNDING_ORDER
    : FUNDING_ORDER.filter(fr => FUNDING_MAX[fr] >= (selectedMinTeamSize as number));
  // Column visibility
  const [visibleCols, setVisibleCols] = useState({
    company: true,
    industry: true,
    teamSize: true,
    funding: true,
    founded: true,
  });
  const toggleCol = (key: keyof typeof visibleCols) => setVisibleCols((p) => ({ ...p, [key]: !p[key] }));

  type ColumnKey = 'company' | 'industry' | 'teamSize' | 'funding' | 'founded';
  const [columnSort, setColumnSort] = useState<{ column: ColumnKey; action: SortAction | null } | null>(null);

  const FOUNDED_YEARS = Array.from({ length: 2025 - 2018 + 1 }, (_, i) => String(2025 - i));

  const compareBySequence = (a: string, b: string, sequence: string[], reverse = false) => {
    const ai = sequence.indexOf(a);
    const bi = sequence.indexOf(b);
    const max = sequence.length + 1;
    const av = ai === -1 ? max : ai;
    const bv = bi === -1 ? max : bi;
    return reverse ? bv - av : av - bv;
  };

  const applySorting = (data: ICompany[]): ICompany[] => {
    if (!columnSort || !columnSort.action) return data;
    const { column, action } = columnSort;
    const copy = data.slice();
    const tiebreak = (x: ICompany, y: ICompany) => x.company_name.localeCompare(y.company_name);

    if (column === 'company' && action.type === 'alpha') {
      return copy.sort((a, b) => action.dir === 'asc' ? a.company_name.localeCompare(b.company_name) : b.company_name.localeCompare(a.company_name));
    }
    // founded: support numeric sort or pin specific year to top
    if (column === 'founded') {
      if (action.type === 'numeric') {
        return copy.sort((a, b) => action.dir === 'asc' ? a.founded_year - b.founded_year : b.founded_year - a.founded_year || tiebreak(a, b));
      }
      if (action.type === 'pin') {
        const year = Number((action as any).value);
        const pinned: ICompany[] = [];
        const others: ICompany[] = [];
        data.forEach((c) => (c.founded_year === year ? pinned.push(c) : others.push(c)));
        return [...pinned, ...others];
      }
    }
    if (column === 'teamSize' && (action.type === 'numeric')) {
      return copy.sort((a, b) => action.dir === 'asc' ? a.team_size - b.team_size : b.team_size - a.team_size || tiebreak(a, b));
    }
    if (column === 'funding') {
      if (action.type === 'pin') {
        const pinned: ICompany[] = [];
        const others: ICompany[] = [];
        data.forEach((c) => (c.funding_round === (action as any).value ? pinned.push(c) : others.push(c)));
        return [...pinned, ...others];
      }
      if (action.type === 'sequence') {
        return copy.sort((a, b) => compareBySequence(a.funding_round, b.funding_round, [...FUNDING_ORDER]) || tiebreak(a, b));
      }
      if (action.type === 'reverse') {
        return copy.sort((a, b) => compareBySequence(a.funding_round, b.funding_round, [...FUNDING_ORDER], true) || tiebreak(a, b));
      }
    }
    if (column === 'industry') {
      if (action.type === 'pin') {
        const pinned: ICompany[] = [];
        const others: ICompany[] = [];
        data.forEach((c) => (c.industry === (action as any).value ? pinned.push(c) : others.push(c)));
        return [...pinned, ...others];
      }
    }
    return data;
  };

  const fetchData = async () => {
    const collectionId = selectedCollectionIdRef.current;
    setIsLoading(true);
    const params: Record<string, any> = {
      offset,
      limit: pageSize,
    };
    if (filterText.trim()) params.search = filterText.trim();
    if (industriesSelected.length > 0) params.industries = industriesSelected;
    if (fundingFilters.length > 0) params.funding = fundingFilters;
    if (sizeRanges.length > 0) params.sizeRanges = sizeRanges;
    if (filterLikedOnly) params.liked_only = true;

    const newResponse = await getCollectionsById(collectionId, params);
    setResponse(newResponse.companies);
    setTotal(newResponse.total);
    if (offset > 0 && offset >= newResponse.total) {
      // If the current page is beyond the new total (e.g., after deletions), reset to first page
      setOffset(0);
    }
    // show first page immediately
    setIsLoading(false);
    // fetch the entire list in background (do not block UI) with simple memo cache
    if (newResponse.total > 0) {
      setAllCompanies((prev) => (prev.length ? prev : newResponse.companies));
      const key = JSON.stringify({ id: collectionId, q: { ...params, offset: 0, limit: newResponse.total } });
      const cached = allCacheRef.current.get(key);
      if (cached) {
        if (selectedCollectionIdRef.current === collectionId) setAllCompanies(cached);
        return;
      }
      const allParams: Record<string, any> = { ...params, offset: 0, limit: newResponse.total };
      getCollectionsById(collectionId, allParams)
        .then((allResp) => {
          if (selectedCollectionIdRef.current === collectionId) {
            setAllCompanies(allResp.companies);
            allCacheRef.current.set(key, allResp.companies);
          }
        })
        .catch(() => {
        });
    } else {
      setAllCompanies([]);
    }
  };

  useEffect(() => {
    // Keep ref in sync for stale-response guards
    selectedCollectionIdRef.current = props.selectedCollectionId;
  }, [props.selectedCollectionId]);

  useEffect(() => {
    if (isSwitchingRef.current) return;
    fetchData();
  }, [offset, pageSize, filterText, industriesSelected, fundingFilters, sizeRanges, filterLikedOnly]);

  useEffect(() => {
    // Immediately reset state when collection changes for faster switching and fetch once
    isSwitchingRef.current = true;
    setOffset(0);
    setSelectionMode('none');
    setSelectedIds(new Set());
    setExcludedIds(new Set());
    setResponse([]);
    setTotal(0);
    setAllCompanies([]);
    allCacheRef.current.clear();
    // Fetch once for the new collection
    (async () => {
      await fetchData();
      isSwitchingRef.current = false;
    })();
  }, [props.selectedCollectionId]);

  // Listen for live count increments from background bulk operations
  useEffect(() => {
    // Reset per-collection one-time refresh flag when switching lists
    hasRefreshedFirstBucketRef.current = false;
  }, [props.selectedCollectionId]);

  useEffect(() => {
    const onIncrement = (e: Event) => {
      const custom = e as CustomEvent<{ collectionId: string; amount: number }>;
      if (custom.detail?.collectionId !== props.selectedCollectionId) return;
      setTotal((prev) => prev + (custom.detail.amount || 0));
      // Only auto-refresh once, when on the first page, on the first 50-item increment
      if (offset === 0 && !hasRefreshedFirstBucketRef.current && !isLoading) {
        hasRefreshedFirstBucketRef.current = true;
        fetchData();
      }
    };
    window.addEventListener('collection:count-increment' as any, onIncrement as any);
    return () => window.removeEventListener('collection:count-increment' as any, onIncrement as any);
  }, [props.selectedCollectionId, offset, isLoading, fetchData]);

  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.ceil(total / pageSize);
  const displayFrom = total === 0 ? 0 : offset + 1;
  const displayTo = total === 0 ? 0 : Math.min(offset + pageSize, total);
  const displayCurrentPage = total === 0 ? 0 : currentPage;
  const displayTotalPages = total === 0 ? 0 : totalPages;

  // Helper functions for selection state
  const isCompanySelected = (companyId: number): boolean => {
    if (selectionMode === 'all') {
      return !excludedIds.has(companyId);
    }
    return selectedIds.has(companyId);
  };

  const getSelectedCount = (): number => {
    if (selectionMode === 'all') {
      return total - excludedIds.size;
    }
    return selectedIds.size;
  };

  const getSelectedCompanyIds = (): number[] => {
    if (selectionMode === 'all') {
      // Return mode='all' for API calls
      return [];
    }
    return Array.from(selectedIds);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      if (total > response.length) {
        // More companies exist beyond current page - select all in collection
        setSelectionMode('all');
        setExcludedIds(new Set());
        setSelectedIds(new Set());
      } else {
        //selects on current page
        setSelectionMode('none');
        setSelectedIds(new Set(response.map(c => c.id)));
        setExcludedIds(new Set());
      }
    } else {
      // Deselect all
      setSelectionMode('none');
      setSelectedIds(new Set());
      setExcludedIds(new Set());
    }
  };

  const handleSelectCompany = (companyId: number, checked: boolean) => {
    if (selectionMode === 'all') {
      const newExcluded = new Set(excludedIds);
      if (checked) {
        newExcluded.delete(companyId);
      } else {
        newExcluded.add(companyId);
      }
      setExcludedIds(newExcluded);
    } else {
      const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(companyId);
    } else {
      newSelected.delete(companyId);
    }
      setSelectedIds(newSelected);
    }
  };

  // Find the "Liked Companies List" collection
  const likedCollection = props.collectionResponse?.find(c => 
    c.collection_name === "Liked Companies List"
  );



  const [isAssigning, setIsAssigning] = useState(false);

  const handleAssign = async (targetCollectionId: string, targetName: string) => {
    if (isAssigning) return;
    
    const mode = selectionMode === 'all' ? 'all' : 'selected';
    const companyIds = getSelectedCompanyIds();

    if (mode === 'selected' && companyIds.length === 0) {
      alert('No companies selected');
      return;
    }

    setIsAssigning(true);
    try {
      const result = await startBulkAdd(props.selectedCollectionId, targetCollectionId, {
        mode,
        companyIds: mode === 'selected' ? companyIds : undefined,
      });

      const task: BackgroundTask = {
        taskId: result.task_id,
        type: 'bulk_add',
        sourceCollectionName: props.getCollectionName(props.selectedCollectionId),
        targetCollectionName: targetName,
        targetCollectionId,
        description: `Adding ${mode === 'all' ? 'all' : getSelectedCount()} companies to ${targetName}`,
        startTime: new Date(),
      };

      props.onStartBulkTask(task);

      // Reset selection after starting task
      setSelectionMode('none');
      setSelectedIds(new Set());
      setExcludedIds(new Set());
    } catch (error) {
      console.error('Error starting bulk assign:', error);
      alert('Failed to start bulk assign operation');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleBulkAddToLiked = async () => {
    if (isAssigning) return;
    if (!likedCollection) {
      alert('Could not find "Liked Companies List" collection');
      return;
    }

    const mode = selectionMode === 'all' ? 'all' : 'selected';
    const companyIds = getSelectedCompanyIds();

    if (mode === 'selected' && companyIds.length === 0) {
      alert('No companies selected');
      return;
    }

    setIsAssigning(true);
    try {
      const result = await startBulkAdd(props.selectedCollectionId, likedCollection.id, {
        mode,
        companyIds: mode === 'selected' ? companyIds : undefined,
      });

      const task: BackgroundTask = {
        taskId: result.task_id,
        type: 'bulk_add',
        sourceCollectionName: props.getCollectionName(props.selectedCollectionId),
        targetCollectionName: likedCollection.collection_name,
        targetCollectionId: likedCollection.id,
        description: `Moved ${mode === 'all' ? 'all' : getSelectedCount()} companies to ${likedCollection.collection_name}`,
        startTime: new Date(),
      };

      props.onStartBulkTask(task);

      // Reset selection after starting task
      setSelectionMode('none');
      setSelectedIds(new Set());
      setExcludedIds(new Set());

    } catch (error) {
      console.error('Error starting bulk add:', error);
      alert('Failed to start bulk operation');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDeleteSelected = async () => {
    try {
      if (selectionMode === 'all') {
        const excludeIds = Array.from(excludedIds);
        await deleteCompaniesFromCollection(props.selectedCollectionId, { mode: 'all', excludeIds });
      } else {
        const ids = getSelectedCompanyIds();
        if (ids.length === 0) {
          alert('Please select specific companies to remove.');
          return;
        }
        await deleteCompaniesFromCollection(props.selectedCollectionId, { mode: 'selected', companyIds: ids });
      }
      // Refresh current page
      // For simplicity, refetch current page data
      await fetchData();
      // Clear selection
      setSelectionMode('none');
      setSelectedIds(new Set());
      setExcludedIds(new Set());
    } catch (e) {
      console.error('Failed to delete companies:', e);
      alert('Failed to delete from list');
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  // Industry options are static to avoid changing as pages/filters change
  const baseList = (allCompanies && allCompanies.length > 0) ? allCompanies : response;
  const orderedAll = applySorting(baseList);
  const visibleCompanies = orderedAll.slice(offset, Math.min(offset + pageSize, orderedAll.length));
  const isEmpty = total === 0 || orderedAll.length === 0;

  // Flagging state: map of companyId -> end label
  const [flaggedEndById, setFlaggedEndById] = useState<Map<number, string>>(new Map());
  const setFlagForSelected = (endLabel: string | null) => {
    const ids = getSelectedCompanyIds();
    setFlaggedEndById((prev) => {
      const next = new Map(prev);
      ids.forEach((id) => {
        if (endLabel) {
          next.set(id, endLabel);
        } else {
          next.delete(id);
        }
      });
      return next;
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3">
        <CardTitle className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <DropdownMenu open={isCollectionsOpen} onOpenChange={setIsCollectionsOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-8 px-3 rounded-md border border-indigo-500/30">
                  {props.getCollectionName(props.selectedCollectionId)}
                  {total > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">{total}</span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72 p-0" sideOffset={8} align="start">
                <div className="max-h-72 overflow-auto">
                  {props.collectionResponse?.map(col => (
                    <div
                      key={col.id}
                      className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent"
                    >
                      <button
                        className="flex-1 truncate text-left"
                        onClick={() => { props.onChangeCollection(col.id); setIsCollectionsOpen(false); }}
                      >
                        {col.collection_name}
                        {typeof (col as any).count === 'number' && (
                          <span className="ml-2 text-xs text-muted-foreground">{(col as any).count}</span>
                        )}
                      </button>
                      <div className="relative w-4 h-4">
                        {col.id === props.selectedCollectionId && (
                          <Check className="w-4 h-4 absolute inset-0 transition-opacity opacity-100 group-hover:opacity-0" />
                        )}
                        <button
                          className="absolute inset-0 transition-opacity opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600"
                          title={`Delete ${col.collection_name}`}
                          onClick={async (e) => {
                            e.stopPropagation();
                            const confirmed = window.confirm(`Are you sure you want to delete "${col.collection_name}"?`);
                            if (!confirmed) return;
                            try {
                              await deleteCollection(col.id);
                              props.refreshCollections();
                              window.dispatchEvent(new Event('collections:updated'));
                              if (col.id === props.selectedCollectionId) {
                                const next = props.collectionResponse?.find(c => c.id !== col.id);
                                if (next) {
                                  props.onChangeCollection(next.id);
                                }
                              }
                            } catch (err) {
                              alert('You need to stop adding companies to this collection to delete it.');
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline" className="h-8 w-8" title="Create collection">
                  <Plus className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-96 p-3" sideOffset={8} align="start">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs mb-1">Collection name</label>
                    <input
                      value={createName}
                      onChange={(e)=>setCreateName(e.target.value)}
                      placeholder="New collection name"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" className="h-8 px-3" onClick={()=>{ setIsCreateOpen(false); setCreateName(""); }}>Cancel</Button>
                    <Button
                      className="h-8 px-3"
                      disabled={!createName.trim()}
                      onClick={async ()=>{
                        const created = await createCollection(createName.trim());
                        // Refresh global collections so new collection appears everywhere immediately
                        props.refreshCollections();
                        window.dispatchEvent(new Event('collections:updated'));
                        if (getSelectedCount() > 0) {
                          const mode = selectionMode === 'all' ? 'all' : 'selected';
                          const companyIds = getSelectedCompanyIds();
                          await startBulkAdd(props.selectedCollectionId, created.id, { mode, companyIds: mode==='selected' ? companyIds : undefined });
                        }
                        setIsCreateOpen(false);
                        setCreateName("");

                        props.onChangeCollection(created.id);
                      }}
                    >
                      Create
                    </Button>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Row Filters - separate button next to + */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline" className="h-8 w-8" title="Filter rows">
                  <SlidersHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-96 p-4" sideOffset={8} align="start">
                <div className="grid gap-4">
                  <div>
                    <div className="text-sm font-semibold text-left mb-2">Search</div>
                    <input
                      value={filterText}
                      onChange={(e)=>setFilterText(e.target.value)}
                      placeholder="Search company name..."
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <div className="border-t border-border" />
                  <div>
                    <div className="text-sm font-semibold text-left mb-2">Industry</div>
                    <div className="flex flex-wrap gap-2">
                      {ALL_INDUSTRIES.map((ind: string)=> (
                        <button
                          key={ind}
                          type="button"
                          onClick={()=> setIndustriesSelected((prev)=> prev.includes(ind) ? prev.filter(x=>x!==ind) : [...prev, ind])}
                          className={`rounded-full px-3 py-1 text-xs border ${industriesSelected.includes(ind) ? 'bg-[hsl(var(--primary))] text-white border-indigo-600' : 'bg-background border-border'}`}
                        >{ind}</button>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-border" />
                  <div>
                    <div className="text-sm font-semibold text-left mb-2">Team size</div>
                    <div className="flex flex-wrap gap-2">
                      {(["0-10","11-50","51-200","201-500","500+"] as const).map((r)=> (
                        <button
                          key={r}
                          type="button"
                          onClick={()=> setSizeRanges((prev)=> prev.includes(r) ? prev.filter(x=>x!==r) : [...prev, r])}
                          className={`rounded-full px-3 py-1 text-xs border ${sizeRanges.includes(r) ? 'bg-[hsl(var(--primary))] text-white border-indigo-600' : 'bg-background border-border'}`}
                        >{r}</button>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-border" />
                  <div>
                    <div className="text-sm font-semibold text-left mb-2">Funding</div>
                    <div className="flex flex-wrap gap-2">
                      {DISPLAY_FUNDING.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={()=> setFundingFilters((prev)=> prev.includes(f) ? prev.filter(x=>x!==f) : [...prev, f])}
                          className={`rounded-full px-3 py-1 text-xs border ${fundingFilters.includes(f) ? 'bg-[hsl(var(--primary))] text-white border-indigo-600' : 'bg-background border-border'}`}
                        >{f}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="h-8 px-3 text-sm font-normal" onClick={()=>{ setFilterText(''); setIndustriesSelected([]); setFilterLikedOnly(false); setSizeRanges([]); setFundingFilters([]); }}>Reset</Button>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="h-7 flex items-center gap-2 text-sm font-normal text-muted-foreground leading-none">
            <span className="leading-none">
              {getSelectedCount()} selected
              {selectionMode === 'all' && (
                <span className="ml-1 text-[hsl(var(--primary))]">(all)</span>
              )}
            </span>
            {/* Active filter chips */}
            {(industriesSelected.length > 0 || sizeRanges.length > 0 || fundingFilters.length > 0) && (
              <div className="flex items-center gap-2 ml-2">
                {fundingFilters.length > 0 && (
                  <div className="rounded-full bg-background border border-border px-3 py-1 text-xs">
                    Funding <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[hsl(var(--primary))] text-white text-[10px] px-1">{fundingFilters.length}</span>
                  </div>
                )}
                {sizeRanges.length > 0 && (
                  <div className="rounded-full bg-background border border-border px-3 py-1 text-xs">
                    Team <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[hsl(var(--primary))] text-white text-[10px] px-1">{sizeRanges.length}</span>
                  </div>
                )}
                {industriesSelected.length > 0 && (
                  <div className="rounded-full bg-background border border-border px-3 py-1 text-xs">
                    Sector <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[hsl(var(--primary))] text-white text-[10px] px-1">{industriesSelected.length}</span>
                  </div>
                )}
              </div>
            )}
            {/* Customize Columns */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline" className="h-7 w-7" title="Customize columns">
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-60 p-2">
                {[{k:'company',l:'Company'},{k:'industry',l:'Industry'},{k:'teamSize',l:'Team Size'},{k:'funding',l:'Funding'},{k:'founded',l:'Founded'}].map(({k,l}) => (
                  <button
                    key={k}
                    onClick={() => toggleCol(k as keyof typeof visibleCols)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border ${visibleCols[k as keyof typeof visibleCols] ? 'bg-[hsl(var(--primary))] border-indigo-600' : 'bg-background border-border'}`}></span>
                    {l}
                  </button>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {getSelectedCount() > 0 && (
              <div className="h-7 flex items-center gap-2">
                {/* Assign Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="outline" className="h-7 w-7" title="Assign">
                      <MoveRight className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 p-2">
                    <input
                      type="text"
                      placeholder="Search collections..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none"
                    />
                    <div className="max-h-60 overflow-y-auto">
                      {props.collectionResponse
                        ?.filter((col) =>
                          col.collection_name.toLowerCase().includes(search.toLowerCase())
                        )
                        .map((col) => (
                          <button
                            key={col.id}
                            onClick={() => handleAssign(col.id, col.collection_name)}
                            className="flex w-full items-start rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
                          >
                            {col.collection_name}
                          </button>
                        ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* Favourite / Like Button */}
                <Button size="icon" variant="outline" className="h-7 w-7" title="Add to Liked" onClick={handleBulkAddToLiked}>
                  <Heart className="h-4 w-4" />
                </Button>
                {/* Flag Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="outline" className="h-7 w-7" title="Flag selected">
                      <Flag className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-44 p-1">
                    {[
                      { label: 'No date', value: 'no date' },
                      { label: 'Tomorrow', value: 'tomorrow' },
                      { label: 'In 3 days', value: '3 days' },
                      { label: 'Next week', value: 'next week' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent"
                        onClick={() => setFlagForSelected(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <div className="border-t border-border my-1" />
                    <button
                      className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent"
                      onClick={() => setFlagForSelected(null)}
                    >
                      Clear flag
                    </button>
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* Delete Button with confirm */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="outline" className="h-7 w-7" title="Remove from List" onClick={() => setShowDeleteConfirm(true)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  {showDeleteConfirm && (
                    <DropdownMenuContent className="w-64 p-3" sideOffset={8} align="end">
                      <div className="space-y-3">
                        <div className="text-sm">Are you sure you want to delete these companies from this list?</div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>No</Button>
                          <Button size="sm" onClick={handleDeleteSelected}>Yes</Button>
                        </div>
                      </div>
                    </DropdownMenuContent>
                  )}
                </DropdownMenu>
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-muted-foreground">Loading companies...</div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto">
              {isEmpty ? (
                <div className="flex justify-center items-center h-full">
                  <div className="text-muted-foreground">This collection is empty.</div>
                </div>
              ) : (
              <Table className="w-full table-fixed">
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="h-10 [&>th]:py-0">
                    <TableHead className="w-12 text-left h-10 align-middle border-r border-border">
                      <Checkbox
                        checked={
                          selectionMode === 'all' || 
                          (visibleCompanies.length > 0 && visibleCompanies.every(c => isCompanySelected(c.id)))
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    {visibleCols.company && (
                      <TableHead className="w-64 text-left h-10 align-middle border-r border-border">
                        <div className="flex items-center justify-between gap-2 group">
                          <span>Company</span>
                          <ColumnFilterMenu
                            variant="alpha"
                            label="Company"
                            active={columnSort?.column === 'company' ? columnSort.action ?? undefined : undefined}
                            onChange={(a)=> setColumnSort({ column: 'company', action: a })}
                          />
                        </div>
                      </TableHead>
                    )}
                    {visibleCols.industry && (
                      <TableHead className="w-48 text-left h-10 align-middle border-r border-border">
                        <div className="flex items-center justify-between gap-2 group">
                          <span>Industry</span>
                          <ColumnFilterMenu
                            variant="categorical"
                            label="Industry"
                            sequence={ALL_INDUSTRIES}
                            showSequence={false}
                            showReverse={false}
                            active={columnSort?.column === 'industry' ? columnSort.action ?? undefined : undefined}
                            onChange={(a)=> setColumnSort({ column: 'industry', action: a })}
                          />
                        </div>
                      </TableHead>
                    )}
                    {visibleCols.teamSize && (
                      <TableHead className="w-24 text-left h-10 align-middle border-r border-border">
                        <div className="flex items-center justify-between gap-2 group">
                          <span>Team Size</span>
                          <ColumnFilterMenu
                            variant="numeric"
                            label="Team Size"
                            active={columnSort?.column === 'teamSize' ? columnSort.action ?? undefined : undefined}
                            onChange={(a)=> setColumnSort({ column: 'teamSize', action: a })}
                          />
                        </div>
                      </TableHead>
                    )}
                    {visibleCols.funding && (
                      <TableHead className="w-32 text-left h-10 align-middle border-r border-border">
                        <div className="flex items-center justify-between gap-2 group">
                          <span>Funding</span>
                          <ColumnFilterMenu
                            variant="categorical"
                            label="Funding"
                            sequence={[...FUNDING_ORDER] as unknown as string[]}
                            active={columnSort?.column === 'funding' ? columnSort.action ?? undefined : undefined}
                            onChange={(a)=> setColumnSort({ column: 'funding', action: a })}
                          />
                        </div>
                      </TableHead>
                    )}
                    {visibleCols.founded && (
                      <TableHead className="w-24 text-left h-10 align-middle">
                        <div className="flex items-center justify-between gap-2 group">
                          <span>Founded</span>
                          <ColumnFilterMenu
                            variant="categorical"
                            label="Founded"
                            sequence={FOUNDED_YEARS}
                            showSequence={false}
                            showReverse={false}
                            active={columnSort?.column === 'founded' ? columnSort.action ?? undefined : undefined}
                            onChange={(a)=> setColumnSort({ column: 'founded', action: a })}
                          />
                        </div>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleCompanies.map((company, idx) => {
                    const isFlagged = flaggedEndById.has(company.id);
                    return (
                    <TableRow
                      key={company.id}
                      className={`h-12 table-row-appear ${isFlagged ? 'bg-[hsl(var(--primary))]' : ''}`}
                      style={{ animationDelay: `${idx * 20}ms` }}
                    >
                      <TableCell className="w-12 text-left align-middle border-r border-border">
                        <Checkbox
                          checked={isCompanySelected(company.id)}
                          onCheckedChange={(checked) => 
                            handleSelectCompany(company.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      {visibleCols.company && (
                        <TableCell className="w-64 font-medium text-left align-middle border-r border-border">{company.company_name}</TableCell>
                      )}
                      {visibleCols.industry && (
                        <TableCell className="w-48 text-left align-middle border-r border-border">{company.industry}</TableCell>
                      )}
                      {visibleCols.teamSize && (
                        <TableCell className="w-24 text-left align-middle border-r border-border">{company.team_size}</TableCell>
                      )}
                      {visibleCols.funding && (
                        <TableCell className="w-32 text-left align-middle border-r border-border">{company.funding_round}</TableCell>
                      )}
                      {visibleCols.founded && (
                        <TableCell className="w-24 text-left align-middle">{company.founded_year}</TableCell>
                      )}
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
              )}
            </div>
            
            {/* Pagination */}
            <div className="flex items-center justify-between p-4 border-t bg-background">
              <div className="text-sm text-muted-foreground">
                Showing {displayFrom} to {displayTo} of {total.toLocaleString()} companies
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(Math.max(0, offset - pageSize))}
                  disabled={offset === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="text-sm">
                  Page {displayCurrentPage} of {displayTotalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(offset + pageSize)}
                  disabled={offset + pageSize >= total || total === 0}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>


          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanyTable;