import Navbar from "@/src/components/nav-bar"
import SiteItem from "@/src/components/site-item";

export default function Home() {
  return (
    <main>
      <Navbar />

      <div className="m-8">
        <SiteItem url="/sites/hyunchung" />
      </div>
    </main>
  );
}
