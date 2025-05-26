import { socials } from "@/data/socials";

export function FooterSection() {
  return (
    <section className="min-h-[50vh] flex items-end w-full">
      <div className="w-full">
        {/* Main Footer Content */}
        <div className="container mx-auto px-4 py-10 sm:py-20">
          <div className="space-y-12 sm:space-y-16">
            {/* Top Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
              {/* Brand Column */}
              <div className="space-y-6">
                <h3 className="text-xl sm:text-2xl font-bold">LORDS</h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  The future of gaming is onchain. Join us in building the next
                  generation of games.
                </p>
                <div className="flex space-x-4">
                  {socials.map((social) => (
                    <a
                      key={social.id}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="w-5 h-5 fill-current"
                        aria-hidden="true"
                      >
                        <path d={social.icon} />
                      </svg>
                      <span className="sr-only">{social.name}</span>
                    </a>
                  ))}
                </div>
              </div>

              {/* Resources */}
              <div className="space-y-6">
                <h3 className="text-xl sm:text-2xl font-bold">Resources</h3>
                <ul className="space-y-3">
                  <li>
                    <a
                      href="https://bibliothecadao.xyz/"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      Bibliotheca DAO
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.coingecko.com/en/coins/lords"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      Coin Gecko
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://snapshot.box/#/sn:0x07bd3419669f9f0cc8f19e9e2457089cdd4804a4c41a5729ee9c7fd02ab8ab62"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      Frontinus House
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://shop.realms.world"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      Realms World Shop
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://dev.realms.world"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      Developer Docs
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://drive.google.com/drive/folders/17vrwIjwqifxBVTkHmxoK1VhQ31hVSbDH"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      Brand Assets
                    </a>
                  </li>
                </ul>
              </div>
              <div></div>
            </div>
          </div>
        </div>

        {/* Bottom Bar - Full Width */}
        <div className="w-full border-t">
          <div className="container mx-auto px-4">
            <div className="py-4 sm:py-6 flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
              <p className="text-xs sm:text-sm text-muted-foreground">
                © {new Date().getFullYear()} BiblioDAO. All rights reserved.
              </p>
              <div className="flex space-x-4 sm:space-x-6 text-xs sm:text-sm text-muted-foreground">
                <a href="#" className="hover:text-primary transition-colors">
                  Privacy Policy
                </a>
                <a href="#" className="hover:text-primary transition-colors">
                  Terms of Service
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
