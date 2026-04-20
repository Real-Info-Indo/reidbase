import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  PlusCircle, BarChart3, FileText, MapPin, ClipboardEdit,
  Search, ChevronLeft, ChevronRight, MessageSquare, User, Trash2, Pin,
  FolderPlus, Folder, ChevronDown, ChevronUp, MoreHorizontal, Pencil,
  Settings, LogOut, ExternalLink, HelpCircle, CreditCard } from
"lucide-react";
import reidLogo from "@/assets/REID_Black.svg";
import { NavLink } from "@/components/NavLink";
import { useTier, tierLabels } from "@/contexts/TierContext";
import { useWixAuth } from "@/contexts/WixAuthContext";
import { cn } from "@/lib/utils";
import {
  getConversations, deleteConversation, getFolders, createFolder,
  renameFolder, deleteFolder, moveToFolder, renameConversation, togglePin,
  type Conversation, type Folder as FolderType } from
"@/lib/conversations";
import { logFolder, deleteFolder as deleteLogFolder } from "@/lib/chatLogger";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from
"@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { SettingsDialog } from "@/components/SettingsDialog";

const navItems = [
{ title: "New Analysis", url: "/", icon: PlusCircle },
{ title: "Dashboard", url: "/dashboard", icon: BarChart3 },
{ title: "Market Reports", url: "/market-reports", icon: FileText },
{ title: "Location Reports", url: "/location-reports", icon: MapPin },
{ title: "Appraisal Request", url: "/appraisal-request", icon: ClipboardEdit }];


export function AppSidebar({ onNavigate, isMobile }: {onNavigate?: () => void; isMobile?: boolean;}) {
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [convoSearch, setConvoSearch] = useState("");
  const { tier, userName } = useTier();
  const { logout, member } = useWixAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [folderRenameValue, setFolderRenameValue] = useState("");
  const [renamingConvoId, setRenamingConvoId] = useState<string | null>(null);
  const [convoRenameValue, setConvoRenameValue] = useState("");
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(true);
  const activeConvoId = searchParams.get("c");

  const refresh = () => {
    setConversations(getConversations());
    setFolders(getFolders());
  };

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("conversations-updated", handler);
    return () => window.removeEventListener("conversations-updated", handler);
  }, []);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteConversation(id);
    refresh();
    if (activeConvoId === id) navigate("/");
  };

  const openConvo = (id: string) => {navigate(`/?c=${id}`);onNavigate?.();};

  const handleNavClick = (url: string) => {
    if (url === "/") {
      navigate("/");
      window.dispatchEvent(new Event("new-analysis-reset"));
    }
    onNavigate?.();
  };

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreateFolder = () => {
    const folder = createFolder("New Folder");
    refresh();
    setExpandedFolders((prev) => new Set(prev).add(folder.id));
    setRenamingFolderId(folder.id);
    setFolderRenameValue(folder.name);
  };

  const submitFolderRename = (id: string) => {
    if (folderRenameValue.trim()) {
      renameFolder(id, folderRenameValue.trim());
      refresh();
      // Sync to Supabase after rename is committed
      if (member?.id) {
        logFolder(
          { id, name: folderRenameValue.trim() },
          member.id
        ).catch(err => console.error("logFolder failed:", err));
      }
    }
    setRenamingFolderId(null);
  };

  const handleDeleteFolder = (id: string) => {
    deleteFolder(id);
    refresh();
    window.dispatchEvent(new Event("conversations-updated"));
    // Sync deletion to Supabase
    if (member?.id) {
      deleteLogFolder(id).catch(err => console.error("deleteLogFolder failed:", err));
    }
  };

  const handleMoveToFolder = (convoId: string, folderId: string | undefined) => {
    moveToFolder(convoId, folderId);
    refresh();
    window.dispatchEvent(new Event("conversations-updated"));
  };

  const handleTogglePin = (convoId: string) => {
    togglePin(convoId);
    refresh();
    window.dispatchEvent(new Event("conversations-updated"));
  };

  const searchLower = convoSearch.toLowerCase();
  const filteredConversations = convoSearch
    ? conversations.filter((c) => c.title.toLowerCase().includes(searchLower))
    : conversations;
  const unfolderedConvos = filteredConversations.filter((c) => !c.folderId);
  const pinnedConvos = unfolderedConvos.filter((c) => c.pinned);
  const recentConvos = unfolderedConvos.filter((c) => !c.pinned);
  const convosInFolder = (folderId: string) => filteredConversations.filter((c) => c.folderId === folderId);

  const submitConvoRename = (id: string) => {
    if (convoRenameValue.trim()) {
      renameConversation(id, convoRenameValue.trim());
      refresh();
      window.dispatchEvent(new Event("conversations-updated"));
    }
    setRenamingConvoId(null);
  };

  const ConvoItem = ({ convo }: {convo: Conversation;}) =>
  <div
    className={cn(
      "flex items-center gap-2 w-full text-left text-xs py-1.5 px-2 rounded-md transition-colors group cursor-pointer",
      activeConvoId === convo.id ?
      "bg-sidebar-accent text-sidebar-foreground" :
      "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
    )}>

      <button onClick={() => openConvo(convo.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
        {convo.pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-primary" /> : <MessageSquare className="h-3.5 w-3.5 shrink-0" />}
        {renamingConvoId === convo.id ? (
          <input
            value={convoRenameValue}
            onChange={(e) => setConvoRenameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitConvoRename(convo.id); if (e.key === "Escape") setRenamingConvoId(null); }}
            onBlur={() => submitConvoRename(convo.id)}
            onClick={(e) => e.stopPropagation()}
            className="bg-transparent border-b border-primary/50 focus:outline-none text-xs w-full text-left"
            autoFocus
          />
        ) : (
          <span className="truncate flex-1 text-left">{convo.title}</span>
        )}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-0.5">
            <MoreHorizontal className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-popover min-w-[140px]">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenamingConvoId(convo.id); setConvoRenameValue(convo.title); }} className="cursor-pointer text-xs">
            <Pencil className="h-3.5 w-3.5 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleTogglePin(convo.id); }} className="cursor-pointer text-xs">
            <Pin className="h-3.5 w-3.5 mr-2" />
            {convo.pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          {folders.length > 0 &&
        <>
              <DropdownMenuSeparator />
              {folders.map((f) =>
          <DropdownMenuItem key={f.id} onClick={() => handleMoveToFolder(convo.id, f.id)} className="cursor-pointer text-xs">
                  <Folder className="h-3.5 w-3.5 mr-2" />
                  {f.name}
                </DropdownMenuItem>
          )}
              {convo.folderId &&
          <DropdownMenuItem onClick={() => handleMoveToFolder(convo.id, undefined)} className="cursor-pointer text-xs">
                  <Folder className="h-3.5 w-3.5 mr-2 opacity-40" />
                  Remove from folder
                </DropdownMenuItem>
          }
            </>
        }
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => {e.stopPropagation();handleDelete(e as unknown as React.MouseEvent, convo.id);}} className="cursor-pointer text-xs text-destructive">
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>;


  return (
    <aside
      className={cn("flex flex-col sticky top-0 backdrop-blur-xl text-sidebar-foreground transition-all duration-300 shrink-0 bg-sidebar shadow-[3px_0_8px_-2px_rgba(0,0,0,0.12)] relative z-10",
      isMobile ? "h-full" : "h-screen",
      collapsed ? "w-16" : "w-64"
      )}>

      {/* Logo + collapse (hidden on mobile) */}
      {!isMobile && (
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!collapsed &&
        <a href="https://realinfo.id" target="_blank" rel="noopener noreferrer"><img src={reidLogo} alt="REID Base" className="h-6" /></a>
        }
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors">

          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
      )}

      {/* Nav items */}
      <nav className="py-4 space-y-1 px-2 bg-transparent shrink-0">
        {navItems.map((item) =>
        <NavLink
          key={item.url}
          to={item.url}
          end={item.url === "/"}
          onClick={() => handleNavClick(item.url)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-extralight text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          activeClassName="bg-sidebar-accent text-sidebar-primary font-bold">

            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        )}
      </nav>

      {/* Scrollable recent conversations */}
      {!collapsed && conversations.length > 0 &&
        <div className="flex-1 min-h-0 overflow-y-auto px-2">
          <div className="px-3">
            {(tier === "reid_base_pro" || tier === "enterprise") && (
              <div className="flex items-center justify-end mb-1">
                <button
                  onClick={handleCreateFolder}
                  className="p-1 rounded hover:bg-sidebar-accent transition-colors text-sidebar-muted hover:text-sidebar-foreground"
                  title="New folder"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="relative mb-3">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sidebar-muted pointer-events-none" />
              <input
                value={convoSearch}
                onChange={(e) => setConvoSearch(e.target.value)}
                placeholder="Search conversations"
                className="w-full bg-sidebar-accent/50 border border-sidebar-border rounded-md pl-7 pr-2 py-1.5 text-xs text-sidebar-foreground placeholder:text-sidebar-muted focus:outline-none focus:ring-1 focus:ring-sidebar-primary"
              />
            </div>

            {/* Pinned section */}
            {pinnedConvos.length > 0 && (
              <div className="mb-3">
                <button
                  onClick={() => setPinnedOpen((v) => !v)}
                  className="flex items-center gap-1.5 w-full text-xs font-bold uppercase tracking-wider text-sidebar-muted hover:text-sidebar-foreground py-1 transition-colors"
                >
                  {pinnedOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                  <span>Pinned</span>
                  <span className="text-[10px] ml-auto font-normal">{pinnedConvos.length}</span>
                </button>
                {pinnedOpen && (
                  <div className="space-y-0.5 mt-1">
                    {pinnedConvos.map((convo) => <ConvoItem key={convo.id} convo={convo} />)}
                  </div>
                )}
              </div>
            )}

            {/* Recent section (collapsible) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <button
                  onClick={() => setRecentOpen((v) => !v)}
                  className="flex items-center gap-1.5 flex-1 text-xs font-bold uppercase tracking-wider text-sidebar-muted hover:text-sidebar-foreground py-1 transition-colors"
                >
                  {recentOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                  <span>Recent Analysis</span>
                </button>
              </div>

              {recentOpen && (
                <>
                  {/* Folders */}
                  {folders.map((folder) => {
                    const folderConvos = convosInFolder(folder.id);
                    const isExpanded = expandedFolders.has(folder.id);
                    return (
                      <div key={folder.id} className="mb-1">
                        <div className="flex items-center gap-1 group">
                          <button
                            onClick={() => toggleFolder(folder.id)}
                            className="flex items-center gap-1.5 flex-1 min-w-0 text-xs font-extralight text-sidebar-foreground hover:text-sidebar-foreground py-1 px-1 rounded transition-colors"
                          >
                            {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                            <Folder className="h-3.5 w-3.5 shrink-0" />
                            {renamingFolderId === folder.id ? (
                              <input
                                value={folderRenameValue}
                                onChange={(e) => setFolderRenameValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") submitFolderRename(folder.id); if (e.key === "Escape") setRenamingFolderId(null); }}
                                onBlur={() => submitFolderRename(folder.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-transparent border-b border-primary/50 focus:outline-none text-xs w-full"
                                autoFocus
                              />
                            ) : (
                              <span className="truncate">{folder.name}</span>
                            )}
                            <span className="text-[10px] text-sidebar-muted ml-auto">{folderConvos.length}</span>
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-0.5">
                                <MoreHorizontal className="h-3 w-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover min-w-[120px]">
                              <DropdownMenuItem onClick={() => { setRenamingFolderId(folder.id); setFolderRenameValue(folder.name); }} className="cursor-pointer text-xs">
                                <Pencil className="h-3.5 w-3.5 mr-2" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteFolder(folder.id)} className="cursor-pointer text-xs text-destructive">
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {isExpanded && (
                          <div className="ml-4 space-y-0.5 mt-0.5">
                            {folderConvos.length === 0 ? (
                              <p className="text-[10px] text-sidebar-muted italic px-2 py-1">Empty</p>
                            ) : (
                              folderConvos.map((convo) => <ConvoItem key={convo.id} convo={convo} />)
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Unpinned, unfoldered conversations */}
                  <div className="space-y-0.5 pb-2">
                    {recentConvos.map((convo) => <ConvoItem key={convo.id} convo={convo} />)}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      }

      {/* User profile */}
      <div className="border-t border-sidebar-border p-3">
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-3 w-full rounded-lg p-1.5 hover:bg-sidebar-accent transition-colors text-left">
              {member?.profilePhoto ? (
                <img src={member.profilePhoto} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent">
                  <User className="h-4 w-4 text-sidebar-primary" />
                </div>
              )}
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-sm font-extralight truncate">{userName}</p>
                  <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wider bg-sidebar-primary text-sidebar-primary-foreground px-2 py-0.5 rounded-full">
                    {tierLabels[tier]}
                  </span>
                </div>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-48 p-1.5">
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
            <a
              href="https://www.realinfo.id/profile/my/profile"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Profile
            </a>
            <a
              href="https://www.realinfo.id/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
            >
              <CreditCard className="h-4 w-4" />
              Pricing &amp; Plans
            </a>
            <a
              href="https://wa.me/6282340658006"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
            >
              <HelpCircle className="h-4 w-4" />
              Get help
            </a>
            <div className="my-1 h-px bg-border" />
            <button
              onClick={() => logout()}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </PopoverContent>
        </Popover>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </aside>);

}