import { useEffect, useState } from "react";
import { getCollectionsById, ICompany, ICollection, startBulkAdd } from "../utils/jam-api";
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
import { createCollection } from "@/utils/jam-api";


type SelectionMode = 'none' | 'all';

interface CompanyTableProps {
  selectedCollectionId: string;
  collectionResponse?: ICollection[];
  onStartBulkTask: (task: BackgroundTask) => void;
  getCollectionName: (collectionId: string) => string;
  onChangeCollection: (collectionId: string) => void;
}

const CompanyTable = (props: CompanyTableProps) => {
  const [response, setResponse] = useState<ICompany[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const [pageSize] = useState(25);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('none');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCollectionsOpen, setIsCollectionsOpen] = useState(false);
  const [collectionLabelOverride, setCollectionLabelOverride] = useState<string | undefined>(undefined);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createIncludeSelected, setCreateIncludeSelected] = useState(false);
  // Row Filters
  const [filterText, setFilterText] = useState<string>("");
  const [filterLikedOnly, setFilterLikedOnly] = useState<boolean>(false);
  const [industriesSelected, setIndustriesSelected] = useState<string[]>([]);
  const [sizeRanges, setSizeRanges] = useState<string[]>([]);
  const [fundingFilters, setFundingFilters] = useState<string[]>([]);
  // Column visibility
  const [visibleCols, setVisibleCols] = useState({
    company: true,
    industry: true,
    teamSize: true,
    funding: true,
    founded: true,
  });
  const toggleCol = (key: keyof typeof visibleCols) => setVisibleCols((p) => ({ ...p, [key]: !p[key] }));

  useEffect(() => {
    setIsLoading(true);
    getCollectionsById(props.selectedCollectionId, offset, pageSize).then(
      (newResponse) => {
        setResponse(newResponse.companies);
        setTotal(newResponse.total);
        setIsLoading(false);
      }
    );
  }, [props.selectedCollectionId, offset, pageSize]);

  useEffect(() => {
    setOffset(0);
    setSelectionMode('none');
    setSelectedIds(new Set());
    setExcludedIds(new Set());
  }, [props.selectedCollectionId]);

  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.ceil(total / pageSize);

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



  const handleAssign = async (targetCollectionId: string, targetName: string) => {
    const mode = selectionMode === 'all' ? 'all' : 'selected';
    const companyIds = getSelectedCompanyIds();

    if (mode === 'selected' && companyIds.length === 0) {
      alert('No companies selected');
      return;
    }

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
        description: `Assigning ${mode === 'all' ? 'all' : getSelectedCount()} companies to ${targetName}`,
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
    }
  };

  const handleBulkAddToLiked = async () => {
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
        description: `Adding ${mode === 'all' ? 'all' : getSelectedCount()} companies to ${likedCollection.collection_name}`,
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
    }
  };

  const industries = Array.from(new Set(response.map((c) => c.industry).filter(Boolean)));
  const withinSelectedSizes = (team: number | null | undefined) => {
    if (sizeRanges.length === 0) return true;
    if (team == null) return false;
    return sizeRanges.some((r) => {
      if (r === "0-10") return team >= 0 && team <= 10;
      if (r === "11-50") return team >= 11 && team <= 50;
      if (r === "51-200") return team >= 51 && team <= 200;
      if (r === "201-500") return team >= 201 && team <= 500;
      if (r === "500+") return team >= 501;
      return true;
    });
  };
  const visibleCompanies = response.filter((c) => {
    const matchesText = filterText ? c.company_name.toLowerCase().includes(filterText.toLowerCase()) : true;
    const matchesLiked = filterLikedOnly ? Boolean((c as any).liked) === true : true;
    const matchesIndustry = industriesSelected.length > 0 ? industriesSelected.includes(String(c.industry)) : true;
    const matchesFunding = fundingFilters.length > 0 ? fundingFilters.includes(String(c.funding_round)) : true;
    const matchesSize = withinSelectedSizes(Number(c.team_size));
    return matchesText && matchesLiked && matchesIndustry && matchesFunding && matchesSize;
  });

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
                  {collectionLabelOverride ?? props.getCollectionName(props.selectedCollectionId)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72 p-0" sideOffset={8} align="start">
                <div className="max-h-72 overflow-auto">
                  {props.collectionResponse?.map(col => (
                    <button
                      key={col.id}
                      onClick={() => { props.onChangeCollection(col.id); setCollectionLabelOverride(undefined); setIsCollectionsOpen(false); }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent"
                    >
                      <div className="flex-1 truncate">{col.collection_name}</div>
                      {col.id === props.selectedCollectionId && <Check className="w-4 h-4" />}
                    </button>
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
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={createIncludeSelected}
                      onCheckedChange={(v)=>setCreateIncludeSelected(Boolean(v))}
                      disabled={getSelectedCount() === 0}
                    />
                    Include currently selected companies{getSelectedCount() > 0 ? ` (${getSelectedCount()})` : ''}
                  </label>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" className="h-8 px-3" onClick={()=>{ setIsCreateOpen(false); setCreateName(""); setCreateIncludeSelected(false); }}>Cancel</Button>
                    <Button
                      className="h-8 px-3"
                      disabled={!createName.trim()}
                      onClick={async ()=>{
                        const created = await createCollection(createName.trim());
                        if (createIncludeSelected && getSelectedCount() > 0) {
                          const mode = selectionMode === 'all' ? 'all' : 'selected';
                          const companyIds = getSelectedCompanyIds();
                          await startBulkAdd(props.selectedCollectionId, created.id, { mode, companyIds: mode==='selected' ? companyIds : undefined });
                        }
                        setCollectionLabelOverride(createName.trim());
                        setIsCreateOpen(false);
                        setCreateName("");
                        setCreateIncludeSelected(false);
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
                      {industries.map((ind)=> (
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
                      {Array.from(new Set(response.map((c)=> String(c.funding_round)).filter(Boolean))).map((f)=> (
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
                <span className="ml-1 text-blue-400">(all)</span>
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
                {/* Delete Button */}
                <Button size="icon" variant="outline" className="h-7 w-7" title="Remove from List">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-muted-foreground">Loading companies...</div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto">
              <Table className="w-full table-fixed">
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="h-10 [&>th]:py-0">
                    <TableHead className="w-12 text-left h-10 align-middle border-r border-border">
                      <Checkbox
                        checked={
                          selectionMode === 'all' || 
                          (response.length > 0 && response.every(c => isCompanySelected(c.id)))
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    {visibleCols.company && (<TableHead className="w-64 text-left h-10 align-middle border-r border-border">Company</TableHead>)}
                    {visibleCols.industry && (<TableHead className="w-48 text-left h-10 align-middle border-r border-border">Industry</TableHead>)}
                    {visibleCols.teamSize && (<TableHead className="w-24 text-left h-10 align-middle border-r border-border">Team Size</TableHead>)}
                    {visibleCols.funding && (<TableHead className="w-32 text-left h-10 align-middle border-r border-border">Funding</TableHead>)}
                    {visibleCols.founded && (<TableHead className="w-24 text-left h-10 align-middle">Founded</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleCompanies.map((company) => {
                    const isFlagged = flaggedEndById.has(company.id);
                    return (
                    <TableRow key={company.id} className={`h-12 ${isFlagged ? 'bg-[hsl(var(--primary))]' : ''}`}>
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
            </div>
            
            {/* Pagination */}
            <div className="flex items-center justify-between p-4 border-t bg-background">
              <div className="text-sm text-muted-foreground">
                Showing {offset + 1} to {Math.min(offset + pageSize, total)} of {total.toLocaleString()} companies
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
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(offset + pageSize)}
                  disabled={offset + pageSize >= total}
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