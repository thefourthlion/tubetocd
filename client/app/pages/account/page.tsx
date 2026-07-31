"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { LoadingBlock, PageHeader, PageShell } from "@/components/ui/page";
import {
  AuthUser,
  getMe,
  getStoredUser,
  getToken,
  logout,
} from "@/lib/auth";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());
  const [loading, setLoading] = useState(true);
  const [bio, setBio] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newBio, setNewBio] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/pages/login");
      return;
    }

    getMe()
      .then((me) => setUser(me))
      .catch(() => {
        toast.error("Please sign in again");
        router.push("/pages/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleUpdateProfile = () => {
    if (!user) return;
    setUser({ ...user, name: newUserName || user.name });
    setBio(newBio);
    setIsEditing(false);
    toast.success("Profile updated locally");
  };

  const handleSignOut = () => {
    logout();
    toast.success("Signed out");
    router.push("/pages/login");
  };

  if (loading) {
    return (
      <PageShell width="md">
        <LoadingBlock label="Loading account…" />
      </PageShell>
    );
  }

  const displayName = user?.name || user?.email?.split("@")[0] || "User";

  return (
    <PageShell width="md">
      <PageHeader
        align="center"
        eyebrow="Profile"
        title="Account"
        description="Manage your profile."
      />

      <Panel className="mx-auto flex max-w-md flex-col items-center text-center animate-fade-up">
        <Avatar className="mb-4 h-20 w-20 ring-2 ring-border">
          <AvatarImage src="" />
          <AvatarFallback className="bg-primary/15 font-display text-xl font-bold text-accent-foreground dark:text-primary">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h2 className="mb-1 font-display text-xl font-semibold text-foreground">
          {displayName}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{user?.email}</p>

        {isEditing ? (
          <div className="flex w-full flex-col gap-3 text-left">
            <Input
              label="Display name"
              placeholder="Display name"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
            />
            <Textarea
              label="Bio"
              placeholder="Short bio"
              value={newBio}
              onChange={(e) => setNewBio(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleUpdateProfile}>
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-4 min-h-[1.5em] text-sm text-muted-foreground">
              {bio || "No bio yet."}
            </p>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Pencil className="h-3.5 w-3.5" />}
              onClick={() => {
                setIsEditing(true);
                setNewUserName(user?.name || "");
                setNewBio(bio);
              }}
            >
              Edit profile
            </Button>
          </>
        )}
      </Panel>

      <button
        type="button"
        className="mx-auto mt-6 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        onClick={handleSignOut}
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </button>
    </PageShell>
  );
}
