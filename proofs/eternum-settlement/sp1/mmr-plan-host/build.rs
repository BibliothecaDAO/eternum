const PINNED_SP1_BUILD_IMAGE: &str = "ghcr.io/succinctlabs/sp1@sha256:af8c2f46bb5e417c1c2fb939cd4397c75aa4f2439a9fd7c1f9ce2e0a693f6f6b";

fn main() {
    println!("cargo:rerun-if-env-changed=SP1_DOCKER_IMAGE");
    assert_eq!(
        std::env::var("SP1_DOCKER_IMAGE").as_deref(),
        Ok(PINNED_SP1_BUILD_IMAGE),
        "SP1_DOCKER_IMAGE must select the pinned A13 build image",
    );

    sp1_build::build_program_with_args(
        "../mmr-plan-program",
        sp1_build::BuildArgs {
            docker: true,
            locked: true,
            no_docker_cache: true,
            workspace_directory: Some("../..".to_owned()),
            ..Default::default()
        },
    );
}
