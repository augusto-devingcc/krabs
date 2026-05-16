# DRAFT — pending krabs-cli npm publish in v0.5.
# Until then, install from source: see https://krabs.dev/docs/install
#
# Once `krabs-cli` is published to npm, replace the sha256 below with the
# real one (cli/PUBLISH.md has the exact `curl | shasum -a 256` command),
# and copy this file into the `augusto-devingcc/homebrew-krabs` tap repo.
class Krabs < Formula
  desc "Command-line interface for krabs.dev — a CRM for AI agents"
  homepage "https://krabs.dev"
  url "https://registry.npmjs.org/krabs-cli/-/krabs-cli-0.1.0.tgz"
  sha256 "PLACEHOLDER_REPLACE_AFTER_NPM_PUBLISH"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", "-g", "--prefix=#{libexec}", "krabs-cli"
    bin.install_symlink Dir["#{libexec}/bin/krabs"]
  end

  test do
    assert_match "krabs", shell_output("#{bin}/krabs --version")
  end
end
