# DRAFT — pending `krabs-cli` npm publish.
# Until npm publish, install from source: see https://krabs.dev/docs/install
#
# After publish:
#   1. curl -sL https://registry.npmjs.org/krabs-cli/-/krabs-cli-0.5.0.tgz | shasum -a 256
#   2. Replace sha256 below with the real value (drop the placeholder).
#   3. Copy this file into the `augusto-devingcc/homebrew-krabs` tap repo
#      under Formula/krabs.rb, open a PR, merge.
#   4. Users can then `brew install augusto-devingcc/krabs/krabs`.
class Krabs < Formula
  desc "Command-line interface for krabs.dev — a CRM for AI agents"
  homepage "https://krabs.dev"
  url "https://registry.npmjs.org/krabs-cli/-/krabs-cli-0.5.0.tgz"
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
