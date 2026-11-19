import { Helmet } from "react-helmet-async";
import { AnnouncementCenterPage } from "@orderly.network/ui-notification";
import { useNav } from "@/hooks/useNav";
import { withBasePath } from "@/utils/base-path";
import { generatePageTitle } from "@/utils/utils";

export default function AnnouncementsIndex() {
  const { onRouteChange } = useNav();

  return (
    <>
      <Helmet>
        <title>{generatePageTitle("FROSTDEX ANNOUNCEMENT")}</title>
      </Helmet>
      <main className="oui-mx-auto oui-w-full oui-max-w-5xl oui-px-4 oui-py-8">
        <header className="oui-mb-6 oui-flex oui-flex-col oui-items-center oui-gap-3 oui-text-center">
          <img
            src={withBasePath("/logo.webp")}
            alt="FrostDex"
            className="oui-h-20 oui-w-auto"
          />
          <h1 className="oui-text-2xl oui-font-bold oui-text-base-contrast-80 md:oui-text-3xl">
            FROSTDEX ANNOUNCEMENT
          </h1>
          <p className="oui-max-w-2xl oui-text-sm oui-text-base-contrast-54">
            Orderly listings, delistings, maintenance updates, campaigns, and
            other announcements.
          </p>
        </header>
        <section
          aria-label="Orderly announcements"
          className="oui-rounded-2xl oui-border oui-border-line oui-bg-base-10 oui-p-2 md:oui-p-4"
        >
          <AnnouncementCenterPage routerAdapter={{ onRouteChange }} />
        </section>
      </main>
    </>
  );
}
