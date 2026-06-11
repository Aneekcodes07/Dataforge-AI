import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Zap } from 'lucide-react';
import { scrollReveal, scrollRevealItem } from '@/styles/animations';

export default function FooterSection() {
  return (
    <>
      {/* CTA Section */}
      <section className="landing-section relative bg-background">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-accent/[0.03] to-transparent" />

        <motion.div
          variants={scrollReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="max-w-2xl mx-auto text-center relative z-10"
        >
          <motion.h2
            variants={scrollRevealItem}
            className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight mb-4"
          >
            Start your first extraction
          </motion.h2>
          <motion.p
            variants={scrollRevealItem}
            className="text-lg text-text-secondary mb-8 leading-relaxed"
          >
            Free workspace with demo credentials. Connect a source and run the agent pipeline in minutes.
          </motion.p>
          <motion.div variants={scrollRevealItem} className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/signup"
              className="btn-primary text-base px-6 py-3 rounded-lg inline-flex items-center justify-center gap-2 group"
            >
              Create workspace
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/login"
              className="btn-secondary text-base px-6 py-3 rounded-lg inline-flex items-center justify-center"
            >
              Sign in
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-lg text-text-primary">
                  Data<span className="text-accent">Forge</span>
                </span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                AI-powered data engineering — extraction, cleaning, and export in one platform.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-4">Product</h4>
              <ul className="space-y-2.5">
                {['Features', 'Agent Network', 'Pricing', 'Changelog'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-4">Resources</h4>
              <ul className="space-y-2.5">
                {['Documentation', 'API Reference', 'Tutorials', 'Blog'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-4">Company</h4>
              <ul className="space-y-2.5">
                {['About', 'Careers', 'Privacy', 'Terms'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between pt-8 border-t border-white/[0.06] gap-4">
            <p className="text-sm text-text-tertiary">
              © {new Date().getFullYear()} DataForge AI. All rights reserved.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="#"
                aria-label="GitHub"
                className="w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.06] transition-all"
              >
                <svg className="w-4 h-4 text-text-secondary" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="Twitter"
                className="w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.06] transition-all"
              >
                <svg className="w-4 h-4 text-text-secondary" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="LinkedIn"
                className="w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.06] transition-all"
              >
                <svg className="w-4 h-4 text-text-secondary" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
