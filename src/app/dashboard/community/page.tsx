import { redirect } from "next/navigation";

// The general member directory (any opted-in member, not just mentors) is
// hidden — dashboard/mentors is now the only public member listing. The
// underlying data (directoryVisible, listCommunityMembers) is left
// untouched and dormant rather than deleted, same as every other retired
// mechanism in this app, in case a public directory comes back later.
export default function CommunityPage() {
  redirect("/dashboard/mentors");
}
