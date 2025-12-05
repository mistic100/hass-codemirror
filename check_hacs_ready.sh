#!/bin/bash

# Blueprint Studio - HACS Readiness Check
# This script verifies all necessary files are present and valid

echo "=================================================="
echo "Blueprint Studio - HACS Readiness Check"
echo "=================================================="
echo ""

ERRORS=0
WARNINGS=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} Found: $1"
        return 0
    else
        echo -e "${RED}✗${NC} Missing: $1"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

check_json_valid() {
    if command -v jq &> /dev/null; then
        if jq empty "$1" 2>/dev/null; then
            echo -e "${GREEN}✓${NC} Valid JSON: $1"
            return 0
        else
            echo -e "${RED}✗${NC} Invalid JSON: $1"
            ERRORS=$((ERRORS + 1))
            return 1
        fi
    else
        echo -e "${YELLOW}⚠${NC} Cannot validate JSON (jq not installed): $1"
        WARNINGS=$((WARNINGS + 1))
        return 0
    fi
}

echo "Checking required files..."
echo ""

# Required files
check_file "README.md"
check_file "LICENSE"
check_file "hacs.json"
check_file "info.md"
check_file ".gitignore"

echo ""
echo "Checking integration files..."
echo ""

check_file "custom_components/blueprint_studio/__init__.py"
check_file "custom_components/blueprint_studio/manifest.json"
check_file "custom_components/blueprint_studio/config_flow.py"
check_file "custom_components/blueprint_studio/const.py"
check_file "custom_components/blueprint_studio/strings.json"

echo ""
echo "Checking JSON validity..."
echo ""

check_json_valid "hacs.json"
check_json_valid "custom_components/blueprint_studio/manifest.json"
check_json_valid "custom_components/blueprint_studio/strings.json"

echo ""
echo "Checking optional but recommended files..."
echo ""

check_file "CONTRIBUTING.md" || WARNINGS=$((WARNINGS + 1))
check_file "CHANGELOG.md" || WARNINGS=$((WARNINGS + 1))
check_file "SECURITY.md" || WARNINGS=$((WARNINGS + 1))
check_file "CODE_OF_CONDUCT.md" || WARNINGS=$((WARNINGS + 1))
check_file ".editorconfig" || WARNINGS=$((WARNINGS + 1))

echo ""
echo "Checking GitHub configuration..."
echo ""

check_file ".github/workflows/validate.yaml" || WARNINGS=$((WARNINGS + 1))
check_file ".github/workflows/release.yaml" || WARNINGS=$((WARNINGS + 1))
check_file ".github/ISSUE_TEMPLATE/bug_report.md" || WARNINGS=$((WARNINGS + 1))
check_file ".github/ISSUE_TEMPLATE/feature_request.md" || WARNINGS=$((WARNINGS + 1))
check_file ".github/PULL_REQUEST_TEMPLATE.md" || WARNINGS=$((WARNINGS + 1))

echo ""
echo "Checking version consistency..."
echo ""

if command -v jq &> /dev/null; then
    MANIFEST_VERSION=$(jq -r '.version' custom_components/blueprint_studio/manifest.json 2>/dev/null)
    CONST_VERSION=$(grep 'VERSION = ' custom_components/blueprint_studio/const.py 2>/dev/null | sed 's/.*"\(.*\)".*/\1/')

    if [ "$MANIFEST_VERSION" = "$CONST_VERSION" ]; then
        echo -e "${GREEN}✓${NC} Version consistency: $MANIFEST_VERSION"
    else
        echo -e "${RED}✗${NC} Version mismatch!"
        echo "    manifest.json: $MANIFEST_VERSION"
        echo "    const.py: $CONST_VERSION"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${YELLOW}⚠${NC} Cannot check version (jq not installed)"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "=================================================="
echo "Summary"
echo "=================================================="
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All required checks passed!${NC}"
else
    echo -e "${RED}✗ Found $ERRORS error(s)${NC}"
fi

if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠ Found $WARNINGS warning(s)${NC}"
fi

echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}Ready for HACS publication!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Commit all changes"
    echo "2. Create a git tag: git tag -a v1.0.0 -m 'Release v1.0.0'"
    echo "3. Push with tags: git push origin main --tags"
    echo "4. Create a release on GitHub"
    echo "5. Submit to HACS: https://github.com/hacs/default"
    exit 0
else
    echo -e "${RED}Please fix the errors above before publishing${NC}"
    exit 1
fi
